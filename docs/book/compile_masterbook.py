import os
import re
import subprocess
import time
from markdown_it import MarkdownIt

def compile_masterbook():
    print("=== Compiling Distributed Food Delivery Masterbook ===")
    book_dir = os.path.join(os.path.dirname(__file__))
    
    chapter_files = [
        ("Curriculum & Specification", "00_outline.md"),
        ("Chapter 1: The Monolith Breakdown & System Topology", "ch01_monolith_breakdown_and_topology.md"),
        ("Chapter 2: Containerization & Infrastructure: Docker, Docker Compose & Networking", "ch02_infrastructure_and_docker.md"),
        ("Chapter 3: Relational Persistence & Schema Evolution: PostgreSQL & Flyway", "ch03_relational_persistence_and_flyway.md"),
        ("Chapter 4: In-Memory Acceleration & Shopping Cart Architecture: Redis Hashes & TTL", "ch04_in_memory_acceleration_and_redis_cart.md"),
        ("Chapter 5: Security at the Perimeter: Stateless JWT Authentication & Spring Security", "ch05_stateless_jwt_authentication_and_security.md"),
        ("Chapter 6: The Core Domain Engine: Finite State Machines (FSM) & Order Lifecycle", "ch06_finite_state_machines_and_order_lifecycle.md"),
        ("Chapter 7: Financial Reliability: Idempotent Payments, Redis SETNX & Database Mutexes", "ch07_idempotent_payments_and_redis_setnx.md"),
        ("Chapter 8: Asynchronous Decoupling: Apache Kafka (KRaft), Saga Choreography & DLQ", "ch08_apache_kafka_and_saga_choreography.md"),
        ("Chapter 9: High-Concurrency Dispatch: Redis Geospatial & Redisson Distributed Locks", "ch09_redis_geospatial_and_redisson_locks.md"),
        ("Chapter 10: Real-Time Telemetry: STOMP WebSockets & OSRM Road Routing", "ch10_realtime_websockets_and_osrm_routing.md"),
        ("Chapter 11: Production AI Engineering: Google Gemini 2.5 Flash & Function Calling", "ch11_gemini_ai_and_function_calling.md"),
        ("Chapter 12: Production Observability & Distributed Tracing: Prometheus, Grafana & Zipkin", "ch12_observability_and_tracing.md")
    ]

    md = MarkdownIt('gfm-like')
    
    def process_callouts(text):
        # Convert GitHub callouts: > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING], > [!CAUTION]
        callout_pattern = re.compile(
            r'^\>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][^\n]*\n((?:^\>[^\n]*\n?)*)',
            re.MULTILINE
        )
        def replace_callout(match):
            ctype = match.group(1).lower()
            raw_body = match.group(2)
            clean_lines = []
            for line in raw_body.splitlines():
                clean_lines.append(re.sub(r'^\>\s?', '', line))
            body_text = '\n'.join(clean_lines)
            body_html = md.render(body_text)
            title = ctype.capitalize()
            return f'<div class="callout callout-{ctype}"><div class="callout-title">{title}</div><div class="callout-body">{body_html}</div></div>\n\n'
        
        return callout_pattern.sub(replace_callout, text)

    compiled_chapters_html = []
    toc_items = []

    for idx, (title, filename) in enumerate(chapter_files):
        filepath = os.path.join(book_dir, filename)
        if not os.path.exists(filepath):
            print(f"Warning: {filename} not found!")
            continue
            
        with open(filepath, 'r', encoding='utf-8') as f:
            raw_content = f.read()

        # Generate anchor ID
        anchor_id = f"ch_{idx}" if idx > 0 else "curriculum"
        toc_items.append((title, anchor_id))

        # Pre-process callouts
        processed_md = process_callouts(raw_content)

        # Separate mermaid diagrams before markdown rendering so they don't get tangled
        mermaid_blocks = []
        def stash_mermaid(m):
            idx_m = len(mermaid_blocks)
            mermaid_blocks.append(m.group(1).strip())
            return f"\n\n<!-- MERMAID_BLOCK_{idx_m} -->\n\n"
        
        processed_md = re.sub(r'```mermaid\s*\n(.*?)\n```', stash_mermaid, processed_md, flags=re.DOTALL)

        # Render markdown to HTML
        chapter_html = md.render(processed_md)

        # Restore mermaid blocks as <div class="mermaid">
        for idx_m, m_code in enumerate(mermaid_blocks):
            mermaid_div = f'<div class="mermaid">\n{m_code}\n</div>'
            chapter_html = chapter_html.replace(f"<!-- MERMAID_BLOCK_{idx_m} -->", mermaid_div)
            # Also handle if markdown wrapped it in <p>
            chapter_html = chapter_html.replace(f"<p><!-- MERMAID_BLOCK_{idx_m} --></p>", mermaid_div)

        # Wrap in a section container with page-break
        section_html = f'''
        <div class="chapter-container" id="{anchor_id}">
            <div class="chapter-content">
                {chapter_html}
            </div>
        </div>
        '''
        compiled_chapters_html.append(section_html)
        print(f"Processed: {filename} ({len(raw_content)} chars)")

    # Build Table of Contents HTML
    toc_html_list = []
    for title, anchor_id in toc_items:
        toc_html_list.append(f'<li><a href="#{anchor_id}">{title}</a></li>')
    toc_html = '\n'.join(toc_html_list)

    html_template = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Architecting Scalable Systems: From First Principles to Production</title>
    <!-- KaTeX for Math -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
    
    <!-- Mermaid for Diagrams -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({{ 
            startOnLoad: true, 
            theme: 'neutral',
            securityLevel: 'loose',
            flowchart: {{ useMaxWidth: true, htmlLabels: true }}
        }});
        document.addEventListener("DOMContentLoaded", function() {{
            if (window.renderMathInElement) {{
                renderMathInElement(document.body, {{
                    delimiters: [
                        {{left: "$$", right: "$$", display: true}},
                        {{left: "$", right: "$", display: false}},
                        {{left: "\\\\(", right: "\\\\)", display: false}},
                        {{left: "\\\\[", right: "\\\\]", display: true}}
                    ]
                }});
            }}
        }});
    </script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@300;400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap');

        @page {{
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
            @bottom-right {{
                content: counter(page);
                font-family: 'Inter', sans-serif;
                font-size: 9pt;
                color: #64748b;
            }}
            @bottom-left {{
                content: "Architecting Scalable Systems — Tanish Chahal";
                font-family: 'Inter', sans-serif;
                font-size: 8pt;
                color: #94a3b8;
            }}
        }}

        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 10.5pt;
            line-height: 1.65;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
        }}

        /* Cover Page */
        .cover-page {{
            page-break-after: always;
            height: 90vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
            color: #ffffff;
            padding: 40px;
            border-radius: 12px;
            box-sizing: border-box;
        }}
        .cover-badge {{
            display: inline-block;
            background: rgba(99, 102, 241, 0.2);
            border: 1px solid #6366f1;
            color: #a5b4fc;
            padding: 6px 16px;
            border-radius: 9999px;
            font-size: 10pt;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 24px;
        }}
        .cover-title {{
            font-size: 32pt;
            font-weight: 800;
            line-height: 1.15;
            margin: 0 0 16px 0;
            background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        .cover-subtitle {{
            font-size: 14pt;
            font-weight: 400;
            color: #94a3b8;
            max-width: 650px;
            line-height: 1.5;
            margin: 0 0 40px 0;
        }}
        .cover-author {{
            font-size: 13pt;
            font-weight: 600;
            color: #f8fafc;
            margin-bottom: 8px;
        }}
        .cover-repo {{
            font-family: 'Fira Code', monospace;
            font-size: 9.5pt;
            color: #818cf8;
            background: rgba(0, 0, 0, 0.4);
            padding: 6px 14px;
            border-radius: 6px;
            margin-bottom: 36px;
        }}
        .cover-meta {{
            font-size: 9pt;
            color: #64748b;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 20px;
            max-width: 500px;
        }}

        /* Table of Contents */
        .toc-page {{
            page-break-after: always;
            padding: 40px 10px;
        }}
        .toc-title {{
            font-size: 22pt;
            font-weight: 800;
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
            margin-bottom: 24px;
        }}
        .toc-list {{
            list-style: none;
            padding: 0;
            margin: 0;
        }}
        .toc-list li {{
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px dotted #cbd5e1;
        }}
        .toc-list a {{
            text-decoration: none;
            color: #2563eb;
            font-weight: 500;
            font-size: 11pt;
        }}
        .toc-list a:hover {{
            text-decoration: underline;
        }}

        /* Chapter Containers */
        .chapter-container {{
            page-break-before: always;
            padding-top: 20px;
        }}

        h1 {{
            font-size: 22pt;
            font-weight: 800;
            color: #0f172a;
            line-height: 1.2;
            margin-top: 0;
            margin-bottom: 6px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
        }}
        h2 {{
            font-size: 15pt;
            font-weight: 700;
            color: #1e293b;
            margin-top: 24px;
            margin-bottom: 12px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 6px;
        }}
        h3 {{
            font-size: 12.5pt;
            font-weight: 600;
            color: #334155;
            margin-top: 20px;
            margin-bottom: 8px;
        }}
        h4 {{
            font-size: 11pt;
            font-weight: 600;
            color: #475569;
            margin-top: 14px;
            margin-bottom: 6px;
        }}

        p {{
            margin-top: 0;
            margin-bottom: 14px;
            text-align: justify;
        }}

        /* Code Blocks */
        pre {{
            background-color: #0f172a;
            color: #f8fafc;
            padding: 14px 18px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 8.5pt;
            line-height: 1.5;
            border: 1px solid #1e293b;
            margin: 14px 0;
            page-break-inside: avoid;
        }}
        code {{
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 9pt;
            background-color: #f1f5f9;
            color: #0f172a;
            padding: 2px 5px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }}
        pre code {{
            background-color: transparent;
            color: inherit;
            padding: 0;
            border: none;
            font-size: inherit;
        }}

        /* Tables */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 18px 0;
            font-size: 9pt;
            page-break-inside: avoid;
        }}
        th, td {{
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            text-align: left;
        }}
        th {{
            background-color: #f8fafc;
            font-weight: 600;
            color: #0f172a;
        }}
        tr:nth-child(even) {{
            background-color: #f8fafc;
        }}

        /* Callouts / Alerts */
        .callout {{
            border-left: 4px solid #3b82f6;
            background-color: #f8fafc;
            padding: 12px 16px;
            margin: 16px 0;
            border-radius: 0 8px 8px 0;
            page-break-inside: avoid;
        }}
        .callout-title {{
            font-weight: 700;
            font-size: 9.5pt;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        .callout-note {{ border-left-color: #3b82f6; background-color: #eff6ff; }}
        .callout-note .callout-title {{ color: #1d4ed8; }}
        .callout-tip {{ border-left-color: #10b981; background-color: #ecfdf5; }}
        .callout-tip .callout-title {{ color: #047857; }}
        .callout-important {{ border-left-color: #8b5cf6; background-color: #f5f3ff; }}
        .callout-important .callout-title {{ color: #6d28d9; }}
        .callout-warning {{ border-left-color: #f59e0b; background-color: #fffbeb; }}
        .callout-warning .callout-title {{ color: #b45309; }}
        .callout-caution {{ border-left-color: #ef4444; background-color: #fef2f2; }}
        .callout-caution .callout-title {{ color: #b91c1c; }}

        /* Diagrams */
        .mermaid {{
            text-align: center;
            margin: 20px 0;
            background-color: #f8fafc;
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            page-break-inside: avoid;
        }}

        blockquote {{
            border-left: 3px solid #94a3b8;
            margin: 12px 0;
            padding-left: 14px;
            color: #475569;
            font-style: italic;
        }}

        ul, ol {{
            margin-top: 0;
            margin-bottom: 14px;
            padding-left: 24px;
        }}
        li {{
            margin-bottom: 4px;
        }}

        hr {{
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 24px 0;
        }}
    </style>
</head>
<body>

    <!-- FRONT COVER -->
    <div class="cover-page">
        <div class="cover-badge">Complete Enterprise Engineering Guide</div>
        <h1 class="cover-title">Architecting Scalable Systems</h1>
        <div class="cover-subtitle">From First Principles to Production: Building an Enterprise Event-Driven Food Delivery Platform (Swiggy / Zomato Architecture)</div>
        <div class="cover-author">By Tanish Chahal</div>
        <div class="cover-repo">chahaltanish57-wq/distributed-food-delivery-backend</div>
        <div class="cover-meta">
            Spring Boot 3.3 • Apache Kafka KRaft 3.8 • Redis 7 • PostgreSQL 16 • Redisson Distributed Mutexes<br/>
            STOMP WebSockets • Google Gemini 2.5 Flash • Prometheus • Grafana • OpenZipkin Distributed Tracing
        </div>
    </div>

    <!-- TABLE OF CONTENTS -->
    <div class="toc-page">
        <div class="toc-title">Table of Contents</div>
        <ul class="toc-list">
            {toc_html}
        </ul>
    </div>

    <!-- ALL CHAPTERS -->
    {''.join(compiled_chapters_html)}

</body>
</html>
'''

    output_html_path = os.path.join(book_dir, "Food_Delivery_Distributed_Systems_Masterbook.html")
    with open(output_html_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    print(f"Masterbook HTML generated: {output_html_path} ({len(html_template)} bytes)")

    # Render PDF using Microsoft Edge headless
    edge_paths = [
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
    ]
    edge_exe = None
    for p in edge_paths:
        if os.path.exists(p):
            edge_exe = p
            break

    if edge_exe:
        output_pdf_path = os.path.join(book_dir, "Food_Delivery_Distributed_Systems_Masterbook.pdf")
        print(f"Launching headless Edge from: {edge_exe}")
        cmd = [
            edge_exe,
            "--headless=new",
            "--disable-gpu",
            "--run-all-compositor-stages-before-draw",
            "--virtual-time-budget=12000",
            "--print-to-pdf-no-header",
            f"--print-to-pdf={output_pdf_path}",
            output_html_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        print("Edge stdout:", res.stdout)
        print("Edge stderr:", res.stderr)
        if os.path.exists(output_pdf_path):
            print(f"SUCCESS! Masterbook PDF compiled successfully: {output_pdf_path} ({os.path.getsize(output_pdf_path)} bytes)")
        else:
            print("Warning: PDF output file was not created by Edge.")
    else:
        print("Warning: Edge browser not found. HTML masterbook ready for manual PDF export.")

if __name__ == '__main__':
    compile_masterbook()
