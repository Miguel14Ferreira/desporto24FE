#!/usr/bin/env python3
"""Read-only GitHub QA branch equivalence audit; never deletes refs."""
import json, os, re, urllib.request
REPO=os.environ.get("GITHUB_REPOSITORY","Miguel14Ferreira/desporto24FE")
TOKEN=os.environ.get("GH_TOKEN","")
CANDIDATES=[
"qa/read-indicators-20261023",
"qa/chat-sender-multidevice-20261024",
"qa/inbox-history-search-20261023",
"qa/unified-inbox-browser-flow-20261023",
]
def get(path):
    headers={"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"}
    if TOKEN: headers["Authorization"]="Bearer "+TOKEN
    with urllib.request.urlopen(urllib.request.Request("https://api.github.com/repos/"+REPO+path,headers=headers),timeout=30) as r:
        return json.load(r)
def blob(path,ref):
    from urllib.parse import quote
    data=get("/contents/"+quote(path,safe="/")+"?ref="+quote(ref,safe=""))
    import base64
    return base64.b64decode(data["content"]).decode("utf-8")
def tests(text):
    return sorted(set(re.findall(r"""test(?:\.skip|\.only)?\s*\(\s*['\"]([^'\"]+)""",text)))
def main():
    results=[]
    for name in CANDIDATES:
        branch=get("/git/ref/heads/"+name)["object"]["sha"]
        comparison=get("/compare/develop..."+branch)
        changes=[]
        for f in comparison["files"]:
            path=f["filename"]
            old=blob(path,name)
            try: current=blob(path,"develop")
            except Exception: current=""
            old_tests=tests(old) if path.endswith(".spec.ts") else []
            original_lines=[line.strip() for line in old.splitlines() if len(line.strip())>35 and not line.strip().startswith("//")]
            unmatched_lines=sorted(set(line for line in original_lines if line not in current))
            new_tests=tests(current) if path.endswith(".spec.ts") else []
            old_runs=[s.strip() for s in old.splitlines() if "run: npx playwright test " in s]
            changes.append({"path":path,"exact_content_match":old==current,
                "missing_test_titles":sorted(set(old_tests)-set(new_tests)),
                "unmatched_substantive_lines":unmatched_lines,
                "unmatched_substantive_line_count":len(unmatched_lines),
                "missing_playwright_commands":sorted(set(old_runs)-set(s.strip() for s in current.splitlines())),
                "requires_manual_review":old!=current})
        results.append({"branch":name,"sha":branch,"ahead_by":comparison["ahead_by"],
            "behind_by":comparison["behind_by"],"files":changes,
            "eligible_for_ancestry_archive":comparison["behind_by"]==0,
            "automatically_delete":False})
    os.makedirs("artifacts",exist_ok=True)
    with open("artifacts/qa-equivalence-audit.json","w") as f: json.dump(results,f,indent=2)
    for item in results:
        print(item["branch"],"ahead",item["ahead_by"],"review_files",sum(f["requires_manual_review"] for f in item["files"]))
    print("READ_ONLY: no refs or tags changed")
if __name__=="__main__": main()
