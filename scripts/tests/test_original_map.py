"""Structural and collision/partition checks; real-engine playtest remains separate."""
import importlib.util
import json
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('aurora_builder',ROOT/'scripts/build-original-map.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

class OriginalMapTests(unittest.TestCase):
    def setUp(self):
        self.source=json.loads((ROOT/'maps/aurora/layout.json').read_text())
        self.lumps,self.counts=builder.build(self.source)
        self.data=dict(self.lumps)
    def records(self,label,fmt):
        return list(struct.iter_unpack(fmt,self.data[label]))
    def test_reproducible_and_vanilla_order(self):
        first=builder.wad(b'PWAD',self.lumps)
        self.assertEqual(first,builder.wad(b'PWAD',builder.build(self.source)[0]))
        self.assertEqual([n for n,d in self.lumps],['E1M1']+builder.ORDER)
        self.assertEqual(builder.read_wad(first),self.lumps)
        for label,stride in [('THINGS',10),('LINEDEFS',14),('SIDEDEFS',30),('VERTEXES',4),('SEGS',12),('SSECTORS',4),('NODES',28),('SECTORS',26)]:
            self.assertEqual(len(self.data[label])%stride,0,label)
    def test_references_and_closed_clockwise_leaves(self):
        verts=self.records('VERTEXES','<hh');lines=self.records('LINEDEFS','<7H');sides=self.records('SIDEDEFS','<hh8s8s8sH');segs=self.records('SEGS','<6H');leaves=self.records('SSECTORS','<HH')
        for a,b,flags,special,tag,right,left in lines:
            self.assertLess(a,len(verts));self.assertLess(b,len(verts));self.assertLess(right,len(sides))
            self.assertTrue(left==65535 or left<len(sides));self.assertEqual(bool(flags&4),left!=65535)
        for side in sides:self.assertLess(side[-1],self.counts['sectors'])
        for count,first in leaves:
            polygon=segs[first:first+count];self.assertEqual(len(polygon),count)
            area=0
            for i,(a,b,angle,line,direction,offset) in enumerate(polygon):
                self.assertEqual(b,polygon[(i+1)%count][0]);self.assertLess(line,len(lines));self.assertIn(direction,[0,1]);self.assertEqual(offset,0)
                self.assertEqual((a,b),tuple(lines[line][:2])[::1 if direction==0 else -1])
                x,y=verts[a];xx,yy=verts[b];area+=x*yy-xx*y
            self.assertLess(area,0)
    def test_bsp_locates_every_cell_and_children_are_postorder(self):
        nodes=self.records('NODES','<12h2H')
        cells=[(c,r) for c,col in enumerate(self.source['columns']) for r in col['rows']]
        for i,n in enumerate(nodes):
            for child in n[-2:]:self.assertTrue((child&32768 and (child&32767)<len(cells)) or child<i)
        for expected,(c,r) in enumerate(cells):
            for fx,fy in [(0.1,0.1),(0.9,0.9),(0.5,0.5)]:
                xs,ys=self.source['x'],self.source['y'];x=xs[c]+fx*(xs[c+1]-xs[c]);y=ys[r]+fy*(ys[r+1]-ys[r])
                child=len(nodes)-1
                while not child&32768:
                    n=nodes[child];nx,ny,dx,dy=n[:4]
                    side=0 if (x-nx)*dy-(y-ny)*dx>0 else 1
                    child=n[12+side]
                self.assertEqual(child&32767,expected)
    def test_start_resources_exit_and_traversable_portals(self):
        things=self.records('THINGS','<5h');self.assertEqual(sum(t[3]==1 for t in things),1)
        self.assertGreaterEqual(sum(t[3] in [3001,3004] for t in things),6)
        self.assertTrue(any(t[3]==2001 for t in things));self.assertTrue(any(t[3]==2012 for t in things))
        lines=self.records('LINEDEFS','<7H');exits=[line for line in lines if line[3]==11];self.assertEqual(len(exits),1)
        self.assertEqual(exits[0][6],65535)
        sides=self.records('SIDEDEFS','<hh8s8s8sH');sectors=self.records('SECTORS','<hh8s8shhh')
        adjacency={s:set() for s in range(len(sectors))}
        for a,b,flags,special,tag,right,left in lines:
            if left==65535:continue
            front,back=sides[right][-1],sides[left][-1]
            self.assertGreaterEqual(min(sectors[front][1],sectors[back][1])-max(sectors[front][0],sectors[back][0]),56)
            adjacency[front].add(back);adjacency[back].add(front)
        visited={0};pending=[0]
        while pending:
            for other in adjacency[pending.pop()]-visited:visited.add(other);pending.append(other)
        self.assertEqual(len(visited),len(sectors))
        self.assertEqual(sum(s[-2]==9 for s in sectors),1)
    def test_blockmap_covers_all_lines_and_reject_is_conservative(self):
        words=struct.unpack('<'+'H'*(len(self.data['BLOCKMAP'])//2),self.data['BLOCKMAP'])
        w,h=words[2:4]
        for offset in words[4:4+w*h]:
            self.assertEqual(words[offset],0);end=words.index(65535,offset)
            self.assertEqual(set(words[offset+1:end]),set(range(self.counts['linedefs'])))
        self.assertEqual(self.data['REJECT'],bytes((self.counts['sectors']**2+7)//8))
    def test_composite_preserves_every_non_e1m1_base_lump(self):
        base=builder.read_wad((ROOT/'web/generated/freedoom1.wad').read_bytes())
        result=builder.read_wad((ROOT/'web/generated/aurora.wad').read_bytes())
        start=next(i for i,l in enumerate(base) if l[0]=='E1M1')
        untouched=lambda lumps:[l for l in lumps if l[0]!='WILV00']
        self.assertEqual(untouched(base[:start]),untouched(result[:start]));self.assertEqual(untouched(base[start+11:]),untouched(result[start+11:]))
        self.assertEqual(result[start:start+11],self.lumps)

    def test_original_title_is_valid_freedoom_composition(self):
        base=builder.read_wad((ROOT/'web/generated/freedoom1.wad').read_bytes())
        patch=builder.title_patch(base)
        self.assertEqual(patch,builder.title_patch(base))
        self.assertNotEqual(patch,dict(base)['WILV00'])
        pixels=builder.decode_patch(patch)
        self.assertLessEqual(len(pixels[0]),300);self.assertEqual(len(pixels),14)
        glyph=builder.decode_patch(dict(base)['STCFN069'])
        for y,row in enumerate(glyph):
            for x,value in enumerate(row):
                self.assertEqual(pixels[y*2][x*2],value)
                self.assertEqual(pixels[y*2+1][x*2+1],value)
        for filename in ['aurora-map.wad','aurora.wad']:
            lumps=builder.read_wad((ROOT/'web/generated'/filename).read_bytes())
            self.assertEqual(sum(label=='WILV00' for label,data in lumps),1)
            self.assertEqual(dict(lumps)['WILV00'],patch)
            index=next(i for i,lump in enumerate(lumps) if lump[0]=='E1M1')
            self.assertEqual(lumps[index:index+11],self.lumps)

if __name__=='__main__':unittest.main()
