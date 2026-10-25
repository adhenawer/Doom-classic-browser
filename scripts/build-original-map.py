#!/usr/bin/env python3
"""Original Aurora geometry and axis-aligned BSP builder. SPDX-License-Identifier: MIT."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA = '7323bcc168c5a45ff10749b339960e98314740a734c30d4b9f3337001f9e703d'
ORDER = ['THINGS','LINEDEFS','SIDEDEFS','VERTEXES','SEGS','SSECTORS','NODES','SECTORS','REJECT','BLOCKMAP']

def name(s):
    return s.encode('ascii').ljust(8, b'\0')

def read_wad(data):
    count, offset = struct.unpack_from('<ii', data, 4)
    return [(data[offset+i*16+8:offset+i*16+16].rstrip(b'\0').decode('ascii'), data[a:a+b])
            for i in range(count) for a,b in [struct.unpack_from('<ii',data,offset+i*16)]]

def wad(signature, lumps):
    payload = bytearray(); directory = bytearray()
    for label, data in lumps:
        directory += struct.pack('<ii8s', 12+len(payload), len(data), name(label))
        payload += data
    return signature + struct.pack('<ii',len(lumps),12+len(payload)) + payload + directory

def build(source):
    xs, ys = source['x'], source['y']
    cells = [(c,r) for c,col in enumerate(source['columns']) for r in col['rows']]
    verts=[]; lines=[]; sides=[]; segments=[]; subsectors=[]; sectors=[]; nodes=[]
    vertex_ids={}; edge_ids={}; cell_ids={cell:i for i,cell in enumerate(cells)}
    def vertex(p):
        if p not in vertex_ids:
            vertex_ids[p]=len(verts); verts.append(p)
        return vertex_ids[p]
    for sid,(c,r) in enumerate(cells):
        col=source['columns'][c]
        special=9 if [c,r]==source['secret_cell'] else 0
        sectors.append(struct.pack('<hh8s8shhh',0,col['ceiling'],name('FLOOR4_8'),name('CEIL3_5'),col['light'],special,0))
        points=[(xs[c],ys[r]),(xs[c],ys[r+1]),(xs[c+1],ys[r+1]),(xs[c+1],ys[r])]
        first=len(segments)
        for a,b in zip(points,points[1:]+points[:1]):
            va,vb=vertex(a),vertex(b); key=tuple(sorted((a,b)))
            exit_line = c==len(xs)-2 and r==1 and a[0]==b[0]==xs[-1]
            side_id=len(sides)
            # Middle textures are removed when a matching cell turns an edge into a portal.
            sides.append([0,0,'-','-','SW1COMP' if exit_line else col['wall'],sid])
            if key in edge_ids:
                lid=edge_ids[key]; lines[lid][2]=4; lines[lid][6]=side_id
                sides[lines[lid][5]][4]='-'; sides[side_id][4]='-'
                # Both upper and lower textures cover height changes on either side.
                sides[lines[lid][5]][2:4]=[source['columns'][cells[lines[lid][7]][0]]['wall']]*2
                sides[side_id][2:4]=[col['wall']]*2
                direction=1
            else:
                lid=len(lines);edge_ids[key]=lid
                lines.append([va,vb,1,11 if exit_line else 0,0,side_id,65535,sid]);direction=0
            angle=round(math.atan2(b[1]-a[1],b[0]-a[0])*65536/(2*math.pi)) & 65535
            segments.append(struct.pack('<6H',va,vb,angle,lid,direction,0))
        subsectors.append(struct.pack('<HH',4,first))
    def bounds(group):
        return (max(ys[r+1] for c,r in group),min(ys[r] for c,r in group),
                min(xs[c] for c,r in group),max(xs[c+1] for c,r in group))
    def tree(group):
        if len(group)==1:return 0x8000|cell_ids[group[0]]
        columns=sorted(set(c for c,r in group))
        if len(columns)>1:
            cut=columns[-1];right=[p for p in group if p[0]>=cut];left=[p for p in group if p[0]<cut]
            partition=(xs[cut],ys[0],0,1)
        else:
            cut=max(r for c,r in group);right=[p for p in group if p[1]<cut];left=[p for p in group if p[1]>=cut]
            partition=(xs[columns[0]],ys[cut],1,0)
        child0=tree(right);child1=tree(left)
        index=len(nodes)
        nodes.append(struct.pack('<12h2H',*partition,*bounds(right),*bounds(left),child0,child1))
        return index
    tree(cells)
    # Conservative blockmap: every occupied block lists all lines. Correct, small, no missing collisions.
    width=(xs[-1]-xs[0])//128+1;height=(ys[-1]-ys[0])//128+1
    offset=4+width*height
    blockmap=struct.pack('<hhHH',xs[0],ys[0],width,height)+struct.pack('<'+'H'*(width*height),*([offset]*(width*height)))
    blockmap+=struct.pack('<'+'H'*(len(lines)+2),0,*range(len(lines)),65535)
    lumps=[('E1M1',b''),('THINGS',b''.join(struct.pack('<5h',*t) for t in source['things'])),
           ('LINEDEFS',b''.join(struct.pack('<7H',*line[:7]) for line in lines)),
           ('SIDEDEFS',b''.join(struct.pack('<hh8s8s8sH',x,y,name(up),name(lo),name(mid),s) for x,y,up,lo,mid,s in sides)),
           ('VERTEXES',b''.join(struct.pack('<hh',*p) for p in verts)),('SEGS',b''.join(segments)),
           ('SSECTORS',b''.join(subsectors)),('NODES',b''.join(nodes)),('SECTORS',b''.join(sectors)),
           ('REJECT',bytes((len(cells)**2+7)//8)),('BLOCKMAP',blockmap)]
    counts=dict(things=len(source['things']),vertices=len(verts),linedefs=len(lines),sidedefs=len(sides),segs=len(segments),subsectors=len(subsectors),nodes=len(nodes),sectors=len(sectors))
    return lumps,counts

def decode_patch(data):
    """Read vanilla column posts into a transparent palette-index canvas."""
    width,height,left,top=struct.unpack_from('<4h',data)
    pixels=[[None]*width for _ in range(height)]
    for x in range(width):
        pos=struct.unpack_from('<I',data,8+x*4)[0]
        while data[pos]!=255:
            y,length=data[pos],data[pos+1]
            for row,value in enumerate(data[pos+3:pos+3+length]):
                if y+row>=height:raise ValueError('Patch post outside canvas')
                pixels[y+row][x]=value
            pos+=length+4
    return pixels

def title_patch(base_lumps):
    """Compose an original title from BSD-licensed Freedoom small-font glyphs."""
    assets=dict(base_lumps);text='ESTACAO AURORA';scale=2
    glyphs=[None if char==' ' else decode_patch(assets[f'STCFN{ord(char):03d}']) for char in text]
    widths=[4 if glyph is None else len(glyph[0])+1 for glyph in glyphs]
    width=(sum(widths)-1)*scale;height=max(len(g) for g in glyphs if g)*scale
    if width>300 or height>254:raise ValueError('Title exceeds vanilla patch bounds')
    canvas=[[None]*width for _ in range(height)];cursor=0
    for glyph,advance in zip(glyphs,widths):
        if glyph:
            for y,row in enumerate(glyph):
                for x,value in enumerate(row):
                    if value is not None:
                        for dy in range(scale):
                            for dx in range(scale):canvas[y*scale+dy][cursor+x*scale+dx]=value
        cursor+=advance*scale
    columns=[];offsets=[];offset=8+4*width
    for x in range(width):
        column=bytearray();y=0
        while y<height:
            if canvas[y][x] is None:y+=1;continue
            start=y;values=bytearray()
            while y<height and canvas[y][x] is not None:values.append(canvas[y][x]);y+=1
            column+=bytes([start,len(values),0])+values+b'\0'
        column+=b'\xff';offsets.append(offset);columns.append(column);offset+=len(column)
    return struct.pack('<4h',width,height,0,0)+struct.pack('<'+'I'*width,*offsets)+b''.join(columns)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--base',type=Path,default=ROOT/'web/generated/freedoom1.wad');parser.add_argument('--out',type=Path,default=ROOT/'web/generated');args=parser.parse_args()
    base=args.base.read_bytes()
    if hashlib.sha256(base).hexdigest()!=BASE_SHA:raise SystemExit('Unexpected Freedoom Phase 1 0.13.0 base SHA-256')
    source=json.loads((ROOT/'maps/aurora/layout.json').read_text());lumps,counts=build(source)
    base_lumps=read_wad(base);start=next(i for i,lump in enumerate(base_lumps) if lump[0]=='E1M1')
    if [n for n,d in base_lumps[start+1:start+11]]!=ORDER:raise SystemExit('Unexpected base map order')
    title=title_patch(base_lumps)
    combined=[(label,title if label=='WILV00' else data) for label,data in base_lumps[:start]+lumps+base_lumps[start+11:]]
    pwad_lumps=lumps+[('WILV00',title)]
    args.out.mkdir(parents=True,exist_ok=True)
    manifest={'name':source['name'],'map':'E1M1','originalMaps':['E1M1'],'nextMap':'E1M2 (Freedoom)','base':{'name':'Freedoom Phase 1 0.13.0','sha256':BASE_SHA},'counts':counts,'title':{'text':'ESTACAO AURORA','lump':'WILV00','font':'Freedoom STCFN glyphs, BSD-3-Clause','scale':2},'files':[]}
    for filename,data in [('aurora-map.wad',wad(b'PWAD',pwad_lumps)),('aurora.wad',wad(b'IWAD',combined))]:
        (args.out/filename).write_bytes(data);manifest['files'].append({'name':filename,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
    manifest.update({k: manifest['files'][1][k] for k in ['sha256','bytes']})
    (args.out/'AURORA-CREDITS.txt').write_bytes((ROOT/'docs/maps/AURORA-CREDITS.txt').read_bytes())
    (args.out/'aurora.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(manifest,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
