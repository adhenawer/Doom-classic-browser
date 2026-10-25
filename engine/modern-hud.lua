-- SPDX-License-Identifier: GPL-2.0-or-later
-- DOOM Classic Browser: native Modern overlay, appended after EDGE's HUD script.
-- Only presentation changes. Values come directly from the engine Lua player API.
-- Keep draw_all, Classic HUD, automap, air/time bars and footsteps upstream-owned.

local browser_hud_colors = {
    panel = vec3(10, 14, 21),
    white = vec3(238, 236, 231),
    label = vec3(180, 193, 210),
    accent = vec3(255, 136, 91),
    armor = vec3(156, 198, 215),
    danger = vec3(255, 91, 80),
    track = vec3(68, 79, 94)
}

local function browser_hud_card(x, width, label, value, tint, fraction)
    local c = browser_hud_colors
    hud.set_alpha(0.88)
    hud.solid_box(x, 165, width, 28, c.panel)
    hud.set_alpha(1.0)
    hud.solid_box(x, 165, 1, 28, tint)
    hud.text_color(c.label)
    hud.draw_text(x + 5, 169, label, 3.8)
    hud.text_color(c.white)
    hud.draw_text(x + 5, 176, value, 11)
    hud.solid_box(x + 5, 189, width - 10, 1, c.track)
    if fraction ~= nil then
        local amount = math.max(0, math.min(1, fraction))
        if amount > 0 then
            hud.solid_box(x + 5, 189, (width - 10) * amount, 1, tint)
        end
    end
end

function new_overlay_status()
    local c = browser_hud_colors
    local health = math.floor(player.health())
    local armor = math.floor(player.total_armor())
    local left = hud.x_left + 8
    local right = hud.x_right - 8
    hud.set_scale(1.0)
    hud.set_alpha(1.0)
    hud.text_font("CON_FONT_2") -- Fira Code TrueType, already in EDGE's support pack.

    local health_tint = c.accent
    if health < 35 then health_tint = c.danger end
    browser_hud_card(left, 67, "SAUDE", tostring(health), health_tint, health / 100)
    browser_hud_card(left + 72, 63, "ARMADURA", tostring(armor), c.armor, armor / 100)

    local ammo = "--"
    local ammo_fraction = nil
    local ammo_type = player.ammo_type(1)
    if ammo_type > 0 then
        local count = math.floor(player.main_ammo(1))
        ammo = tostring(count)
        local maximum = player.ammomax(ammo_type)
        if maximum > 0 then ammo_fraction = count / maximum end
    end
    browser_hud_card(right - 74, 74, "MUNICAO", ammo, c.accent, ammo_fraction)

    -- Retain all native card/skull indicators; no duplicated inventory state.
    local keys = {
        {1, "STKEYS0"}, {2, "STKEYS1"}, {3, "STKEYS2"}, {4, "STKEYS9"},
        {5, "STKEYS3"}, {6, "STKEYS4"}, {7, "STKEYS5"}, {8, "STKEYSA"}
    }
    local key_x = left
    for _, key in ipairs(keys) do
        if player.has_key(key[1]) then
            hud.draw_image(key_x, 154, key[2])
            key_x = key_x + 10
        end
    end

    -- Do not leak font/color/alpha/scale into EDGE's other native HUD functions.
    hud.set_scale(1.0)
    hud.set_alpha(1.0)
    hud.text_font("DOOM")
    hud.text_color(hud.NO_COLOR)
end
