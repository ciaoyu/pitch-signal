#!/usr/bin/env python3
"""
纯 Python 版 computed standings 生成器。
从 ESPN API 拉取已赛结果，计算 12 组 48 队的实时积分榜。
输出 JSON + SVG 图表。

用法:
  python3 computed-standings.py                 # 输出 JSON 到 stdout
  python3 computed-standings.py --svg           # 输出 SVG 到 stdout
  python3 computed-standings.py --svg --serve   # 启动 HTTP 服务 (端口 5100)
"""
import json, os, sys, time, math, io
from urllib.request import urlopen, Request

ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world"

# 12 组 48 队（ESPN ID 映射）
GROUPS = {
    'A': ['203', '467', '451', '450'],
    'B': ['206', '452', '4398', '475'],
    'C': ['205', '2869', '2654', '580'],
    'D': ['660', '210', '628', '465'],
    'E': ['481', '11678', '4789', '209'],
    'F': ['449', '627', '466', '659'],
    'G': ['459', '2620', '469', '2666'],
    'H': ['164', '2597', '655', '212'],
    'I': ['478', '654', '4375', '464'],
    'J': ['202', '624', '474', '2917'],
    'K': ['482', '2850', '2570', '208'],
    'L': ['448', '477', '4469', '2659'],
}

# 中文名（fallback 用）
TEAM_ZH = {
    '203':'墨西哥','467':'南非','451':'韩国','450':'捷克',
    '206':'加拿大','452':'波黑','4398':'卡塔尔','475':'瑞士',
    '205':'巴西','2869':'摩洛哥','2654':'海地','580':'苏格兰',
    '660':'美国','210':'巴拉圭','628':'澳大利亚','465':'土耳其',
    '481':'德国','11678':'库拉索','4789':'科特迪瓦','209':'厄瓜多尔',
    '449':'荷兰','627':'日本','466':'瑞典','659':'突尼斯',
    '459':'比利时','2620':'埃及','469':'伊朗','2666':'新西兰',
    '164':'西班牙','2597':'佛得角','655':'沙特阿拉伯','212':'乌拉圭',
    '478':'法国','654':'塞内加尔','4375':'伊拉克','464':'挪威',
    '202':'阿根廷','624':'阿尔及利亚','474':'奥地利','2917':'约旦',
    '482':'葡萄牙','2850':'刚果(金)','2570':'乌兹别克斯坦','208':'哥伦比亚',
    '448':'英格兰','477':'克罗地亚','4469':'加纳','2659':'巴拿马',
}

# 国旗
TEAM_FLAGS = {
    '203':'🇲🇽','467':'🇿🇦','451':'🇰🇷','450':'🇨🇿',
    '206':'🇨🇦','452':'🇧🇦','4398':'🇶🇦','475':'🇨🇭',
    '205':'🇧🇷','2869':'🇲🇦','2654':'🇭🇹','580':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    '660':'🇺🇸','210':'🇵🇾','628':'🇦🇺','465':'🇹🇷',
    '481':'🇩🇪','11678':'🇨🇼','4789':'🇨🇮','209':'🇪🇨',
    '449':'🇳🇱','627':'🇯🇵','466':'🇸🇪','659':'🇹🇳',
    '459':'🇧🇪','2620':'🇪🇬','469':'🇮🇷','2666':'🇳🇿',
    '164':'🇪🇸','2597':'🇨🇻','655':'🇸🇦','212':'🇺🇾',
    '478':'🇫🇷','654':'🇸🇳','4375':'🇮🇶','464':'🇳🇴',
    '202':'🇦🇷','624':'🇩🇿','474':'🇦🇹','2917':'🇯🇴',
    '482':'🇵🇹','2850':'🇨🇩','2570':'🇺🇿','208':'🇨🇴',
    '448':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','477':'🇭🇷','4469':'🇬🇭','2659':'🇵🇦',
}

def espn_fetch(path, cache={}):
    url = f"{ESPN_BASE}{path}"
    if url in cache:
        return cache[url]
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=15) as r:
        data = json.loads(r.read().decode())
    cache[url] = data
    return data

def fetch_team_name(team_id, cache={}):
    """从已缓存的数据中获取队名"""
    return TEAM_ZH.get(team_id, team_id)

def get_completed_results(days_back=14):
    """获取已赛小组赛结果"""
    matches = []
    now = int(time.time() * 1000)
    
    # Build team-to-group lookup
    team_to_group = {}
    for g, ids in GROUPS.items():
        for tid in ids:
            team_to_group[tid] = g
    
    for i in range(-days_back, 1):
        t = now + i * 86400000
        # Format YYYYMMDD
        from datetime import datetime, timezone
        date_str = datetime.fromtimestamp(t / 1000, tz=timezone.utc).strftime("%Y%m%d")
        
        try:
            data = espn_fetch(f"/scoreboard?dates={date_str}")
            for event in data.get('events', []):
                comp = event.get('competitions', [{}])[0]
                competitors = comp.get('competitors', [])
                if len(competitors) < 2:
                    continue
                
                home = next((c for c in competitors if c.get('homeAway') == 'home'), {})
                away = next((c for c in competitors if c.get('homeAway') == 'away'), {})
                
                home_id = home.get('team', {}).get('id', '')
                away_id = away.get('team', {}).get('id', '')
                
                # Only group matches
                home_group = team_to_group.get(home_id)
                away_group = team_to_group.get(away_id)
                if not home_group or home_group != away_group:
                    continue
                
                # Only completed matches
                status = comp.get('status', {}).get('type', {}).get('state', '')
                if status != 'post':
                    continue
                
                home_score = int(home.get('score', '0') or '0')
                away_score = int(away.get('score', '0') or '0')
                
                matches.append({
                    'id': event.get('id', ''),
                    'date': event.get('date', ''),
                    'group': home_group,
                    'home': {'id': home_id, 'score': home_score,
                             'name': home.get('team', {}).get('displayName', '?')},
                    'away': {'id': away_id, 'score': away_score,
                             'name': away.get('team', {}).get('displayName', '?')},
                })
        except Exception as e:
            pass  # skip dates with no data
    
    return matches

def compute_standings(matches):
    """从已赛结果计算积分榜"""
    # Initialize
    standings = {}
    for g, ids in GROUPS.items():
        for tid in ids:
            standings[tid] = {
                'id': tid,
                'name': TEAM_ZH.get(tid, tid),
                'flag': TEAM_FLAGS.get(tid, '🏳️'),
                'group': g,
                'played': 0, 'wins': 0, 'draws': 0, 'losses': 0,
                'gf': 0, 'ga': 0, 'gd': 0, 'pts': 0,
            }
    
    for m in matches:
        hid, aid = m['home']['id'], m['away']['id']
        hs, as_ = m['home']['score'], m['away']['score']
        
        for tid, sc, oid in [(hid, hs, aid), (aid, as_, hid)]:
            s = standings[tid]
            s['played'] += 1
            s['gf'] += sc
            s['ga'] += as_ if tid == hid else hs
        
        if hs > as_:
            standings[hid]['wins'] += 1
            standings[hid]['pts'] += 3
            standings[aid]['losses'] += 1
        elif as_ > hs:
            standings[aid]['wins'] += 1
            standings[aid]['pts'] += 3
            standings[hid]['losses'] += 1
        else:
            standings[hid]['draws'] += 1
            standings[aid]['draws'] += 1
            standings[hid]['pts'] += 1
            standings[aid]['pts'] += 1
        
        standings[hid]['gd'] = standings[hid]['gf'] - standings[hid]['ga']
        standings[aid]['gd'] = standings[aid]['gf'] - standings[aid]['ga']
    
    # Sort within groups
    result = []
    for g in sorted(GROUPS.keys()):
        teams = [standings[tid] for tid in GROUPS[g]]
        teams.sort(key=lambda t: (-t['pts'], -t['gd'], -t['gf'], t['name']))
        result.append({
            'name': f'小组 {g}',
            'standings': teams,
        })
    
    return {
        'groups': result,
        'completedMatches': len(matches),
        'updatedAt': datetime.utcnow().isoformat() + 'Z',
    }

def render_svg(data):
    """生成积分榜 SVG 图表"""
    groups = data['groups']
    
    svg_width = 1400
    svg_height = 100 + len(groups) * 280  # 估算
    
    # Colors
    bg = "#1a1a2e"
    card_bg = "#16213e"
    card_border = "#0f3460"
    text_primary = "#e0e0e0"
    text_secondary = "#a0a0a0"
    accent = "#e94560"
    accent2 = "#0f3460"
    
    lines = []
    def line(text): lines.append(text)
    
    line(f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}">')
    line(f'<defs><style>.t{{font-family:"SF Pro Display","PingFang SC","Helvetica Neue",sans-serif;}}</style></defs>')
    line(f'<rect width="100%" height="100%" fill="{bg}"/>')
    
    # Title
    line(f'<text x="700" y="50" text-anchor="middle" fill="{accent}" font-size="28" font-weight="bold" class="t">🏆 2026 世界杯 - 实时积分榜</text>')
    line(f'<text x="700" y="75" text-anchor="middle" fill="{text_secondary}" font-size="14" class="t">已赛 {data["completedMatches"]} 场</text>')
    
    y = 100
    for gi, group in enumerate(groups):
        gname = group['name']
        teams = group['standings']
        
        # Group card background
        line(f'<rect x="30" y="{y}" width="1340" height="{45 + len(teams) * 52}" rx="10" fill="{card_bg}" stroke="{card_border}" stroke-width="1"/>')
        
        # Group header
        line(f'<text x="55" y="{y + 30}" fill="{accent}" font-size="16" font-weight="bold" class="t">{gname}</text>')
        
        # Table header
        hx = 55
        headers = ['#', '球队', '赛', '胜', '平', '负', '进', '失', '净', '分']
        hwidths = [30, 340, 40, 40, 40, 40, 40, 40, 50, 50]
        for i, (h, w) in enumerate(zip(headers, hwidths)):
            anchor = "start" if i <= 1 else "middle"
            line(f'<text x="{hx}" y="{y + 50}" fill="{text_secondary}" font-size="11" text-anchor="{anchor}" class="t">{h}</text>')
            hx += w
        
        # Team rows
        for ti, team in enumerate(teams):
            row_y = y + 70 + ti * 52
            
            # Alternating row background
            if ti % 2 == 1:
                line(f'<rect x="40" y="{row_y - 18}" width="1320" height="50" rx="5" fill="rgba(255,255,255,0.03)"/>')
            
            # Top 2 highlight
            if ti < 2:
                line(f'<rect x="40" y="{row_y - 18}" width="6" height="50" rx="3" fill="#00c853"/>')
            
            # Rank number
            line(f'<text x="55" y="{row_y + 15}" fill="{text_primary}" font-size="16" font-weight="bold" class="t">{ti + 1}</text>')
            
            # Flag + Team name
            flag_name = f'{team["flag"]} {team["name"]}'
            line(f'<text x="85" y="{row_y + 15}" fill="{text_primary}" font-size="14" class="t">{flag_name}</text>')
            
            # Stats
            stats = [
                str(team['played']), str(team['wins']), str(team['draws']),
                str(team['losses']), str(team['gf']), str(team['ga']),
                f'+{team["gd"]}' if team['gd'] > 0 else str(team['gd']),
            ]
            stat_x = 55 + 30 + 340  # after rank + name
            for si, s in enumerate(stats):
                color = text_primary
                if si == 6:  # GD
                    color = "#4caf50" if team['gd'] > 0 else "#f44336" if team['gd'] < 0 else text_secondary
                elif si == 4:  # GF
                    color = "#64b5f6"
                elif si == 5:  # GA
                    color = "#ef5350"
                line(f'<text x="{stat_x + 12}" y="{row_y + 15}" fill="{color}" font-size="13" text-anchor="middle" class="t">{s}</text>')
                stat_x += 40
            
            # Points - bold and larger
            pts_x = stat_x + 10
            pts_color = "#ffd54f" if team['pts'] >= 6 else "#ff8a65" if team['pts'] >= 3 else text_primary
            line(f'<text x="{pts_x}" y="{row_y + 15}" fill="{pts_color}" font-size="18" font-weight="bold" text-anchor="middle" class="t">{team["pts"]}</text>')
        
        y += 50 + len(teams) * 52 + 20
    
    # Footer
    line(f'<text x="700" y="{y + 30}" text-anchor="middle" fill="{text_secondary}" font-size="12" class="t">数据来源: ESPN · 仅包含已赛小组赛 · 更新时间: {data["updatedAt"]}</text>')
    
    line('</svg>')
    return '\n'.join(lines)


# ========== HTTP Server ==========
def serve_http(port=5100):
    from http.server import HTTPServer, BaseHTTPRequestHandler
    
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/api/standings-computed':
                data = compute_standings(get_completed_results())
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode())
            elif self.path in ['/standings.svg', '/svg', '/chart']:
                data = compute_standings(get_completed_results())
                svg = render_svg(data)
                self.send_response(200)
                self.send_header('Content-Type', 'image/svg+xml')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(svg.encode())
            elif self.path == '/':
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                html = f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>2026 世界杯积分榜</title>
<style>body{{background:#1a1a2e;color:#e0e0e0;font-family:"SF Pro Display","PingFang SC",sans-serif;text-align:center;padding:20px}}
img{{max-width:100%;height:auto;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.5)}}
a{{color:#e94560}}</style></head>
<body>
<h1>🏆 2026 世界杯实时积分榜</h1>
<img src="/standings.svg" alt="积分榜">
<p><a href="/api/standings-computed">📊 JSON API</a> · <a href="/standings.svg">📈 SVG</a></p>
</body></html>'''
                self.wfile.write(html.encode())
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'Not found')
        
        def log_message(self, format, *args):
            pass  # suppress logs
    
    print(f"⚽ World Cup Standings SVG Server: http://0.0.0.0:{port}")
    print(f"   JSON: http://0.0.0.0:{port}/api/standings-computed")
    print(f"   SVG:  http://0.0.0.0:{port}/standings.svg")
    server = HTTPServer(('0.0.0.0', port), Handler)
    server.serve_forever()


if __name__ == '__main__':
    from datetime import datetime
    
    if '--serve' in sys.argv:
        serve_http(5100)
    elif '--svg' in sys.argv:
        data = compute_standings(get_completed_results())
        svg = render_svg(data)
        print(svg)
    else:
        data = compute_standings(get_completed_results())
        print(json.dumps(data, ensure_ascii=False, indent=2))
