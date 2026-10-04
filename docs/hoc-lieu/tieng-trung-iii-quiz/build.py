import zipfile,re,json
z=zipfile.ZipFile("/Users/joynguyen/Desktop/Bộ quizz(Limio).docx")
x=z.read("word/document.xml").decode()
paras=[]
for p in re.findall(r'<w:p[ >].*?</w:p>',x,flags=re.S):
    t=''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>',p)).strip()
    if t: paras.append(t)
import html
paras=[html.unescape(p) for p in paras]

def split_ans(s):
    m=re.search(r'^(.*?)\s*Đáp án:\s*(.*?)\s*Giải thích:\s*(.*)$',s,flags=re.S)
    return m.group(1),m.group(2).strip(),m.group(3).strip()

def order(frags,ans):
    ans=ans.rstrip('。?？!！')
    out=[];cur=0;rem=list(frags)
    while rem:
        for f in rem:
            if ans.startswith(f,cur):
                out.append(f);cur+=len(f);rem.remove(f);break
        else: raise Exception((frags,ans,out))
    assert cur==len(ans),(frags,ans)
    return out

lessons=[];cur=None;sect=None;i=0
while i<len(paras):
    p=paras[i]
    m=re.match(r'BÀI (\d+) — (.*)',p)
    if m: cur={'n':m.group(1),'title':m.group(2),'q':[]};lessons.append(cur);i+=1;continue
    m=re.match(r'\d\. (Trắc nghiệm|Đúng / Sai|Điền khuyết|Sắp xếp|Ghép cặp)',p)
    if m: sect=m.group(1);i+=1;continue
    if p.startswith('Câu '):
        body=re.sub(r'^Câu \d+\.\s*','',p)
        if sect=='Ghép cặp':
            left=re.findall(r'([A-D])\. (.*?)(?=\s+[A-D]\. |$)',body)
            nxt=paras[i+1]; i+=1
            rest,ans,expl=nxt,None,None
            rest,ans_txt=nxt.split('Đáp án:')
            ans=dict(re.findall(r'([A-D])→(\d)',ans_txt))
            items=re.split(r'\s(?=\d\. )',' '+rest.strip())
            items=[s.strip() for s in items if s.strip()]
            rights={}
            for k,s in enumerate(items):
                mm=re.match(r'(\d)\. (.*)',s)
                if k==0 and not mm: rights['1']=s
                else: rights[mm.group(1)]=mm.group(2)
            assert len(rights)==4,(rest,rights)
            pairs=[{'left':l,'right':rights[ans[k]]} for k,l in left]
            cur['q'].append({'type':'matching','prompt':'Ghép từ Hán với nghĩa tiếng Việt.','explanation':'Đáp án: '+', '.join(f'{k}→{ans[k]}' for k,_ in left),'pairs':pairs,'_raw':body})
        else:
            q,ans,expl=split_ans(body)
            if sect=='Trắc nghiệm':
                mm=re.match(r'(.*?)\s+A\. (.*?)\s+B\. (.*?)\s+C\. (.*?)\s+D\. (.*)$',q,flags=re.S)
                opts=list(mm.groups()[1:])
                cur['q'].append({'type':'mcq','prompt':mm.group(1),'explanation':expl,'options':[{'label':o,'isCorrect':'ABCD'[k]==ans} for k,o in enumerate(opts)]})
            elif sect=='Đúng / Sai':
                cur['q'].append({'type':'true_false','prompt':q,'explanation':expl,'options':[{'label':'Đúng','isCorrect':ans=='Đúng'},{'label':'Sai','isCorrect':ans=='Sai'}]})
            elif sect=='Điền khuyết':
                a=[]
                for part in ans.split(' / '):
                    part=part.strip()
                    a.append(part)
                    mm=re.match(r'(.*?)\s*\((.*?)\)$',part)
                    if mm: a[-1]=mm.group(1); a.append(mm.group(2))
                if ans.startswith('试试'): a=['试','shì']
                if ans.startswith('又'): a=['又...又...','又…又…','又又','yòu...yòu...']
                pr=q.replace('____','＿＿')
                cur['q'].append({'type':'fill_in','prompt':pr,'explanation':expl,'answers':list(dict.fromkeys(a))})
            elif sect=='Sắp xếp':
                frags=[f.strip() for f in q.split(' / ')]
                seq=order(frags,ans)
                cur['q'].append({'type':'ordering','prompt':'Sắp xếp thành câu đúng: '+('“'+ans+'”'),'explanation':expl,'sequence':seq})
    i+=1
out=[]
for l in lessons:
    for q in l['q']: q.pop('_raw',None)
    out.append({'n':l['n'],'title':l['title'],'questions':l['q']})
json.dump(out,open('quiz.json','w'),ensure_ascii=False,indent=1)
for l in out:
    print(l['n'],len(l['questions']))
    for q in l['questions']:
        print(' ',q['type'],q['prompt'][:50],'|',[o['label'] if isinstance(o,dict) and o.get('isCorrect') else '' for o in q.get('options',[])] if q['type'] in('mcq','true_false') else q.get('answers') or q.get('sequence') or [(p['left'],p['right']) for p in q['pairs']])
