import { useState, useEffect } from "react";

const DISC=[
  {id:"D-2026-0042",title:"Pavement spall TWY A intersection",sev:"Critical",stat:"Assigned",loc:"TWY A/B",shop:"CE Pavements",days:9,desc:"12x18 inch spall, 2 inch depth. FOD potential from loose aggregate.",photos:2,notam:null},
  {id:"D-2026-0041",title:"MALSR RWY 01 Stations 7&8 OTS",sev:"Critical",stat:"In Progress",loc:"RWY 01 approach",shop:"CE Electrical",days:4,desc:"MALSR stations 7 and 8 inoperative. Approach lighting degraded. Parts ETA Monday.",photos:3,notam:"01/003"},
  {id:"D-2026-0039",title:"TDZ marking faded RWY 01",sev:"Medium",stat:"Open",loc:"RWY 01 TDZ",shop:"CE Pavements",days:16,desc:"Touchdown zone markings below minimum reflectivity per UFC 3-260-01.",photos:1,notam:null},
  {id:"D-2026-0038",title:"TWY B edge light #14 lens cracked",sev:"Low",stat:"Pending Parts",loc:"TWY B",shop:"CE Electrical",days:18,desc:"Blue edge light lens cracked but illuminating. Replacement on order.",photos:1,notam:"01/002"},
  {id:"D-2026-0037",title:"Standing water near TWY C holdshort",sev:"Medium",stat:"Resolved",loc:"TWY C",shop:"CE Grounds",days:0,desc:"Drain inlet cleared. Monitoring for recurrence.",photos:2,notam:null},
  {id:"D-2026-0036",title:"Runway distance remaining sign tilted",sev:"Low",stat:"Closed",loc:"RWY 01 5000ft",shop:"CE Structures",days:0,desc:"Sign post base re-secured and leveled.",photos:1,notam:null},
];
const NOTAMS=[
  {id:"01/003",src:"FAA",type:"Lighting",title:"MALSR RWY 01 STA 7-8 OTS",eff:"Feb 3",exp:"Feb 15",stat:"Active",text:"KMTC MALSR RWY 01 STATIONS 7 AND 8 OUT OF SERVICE."},
  {id:"01/002",src:"FAA",type:"Lighting",title:"TWY B EDGE LGT 14 REDUCED INTST",eff:"Jan 21",exp:"Mar 1",stat:"Active",text:"KMTC TWY B EDGE LIGHT 14 REDUCED INTENSITY."},
  {id:"N-2026-0088",src:"LOCAL",type:"Construction",title:"TWY A/B REPAIR AREA",eff:"Feb 1",exp:"Feb 28",stat:"Active",text:"CAUTION: PAVEMENT REPAIR IN PROGRESS TWY A/B INTERSECTION."},
  {id:"01/001",src:"FAA",type:"NAVAID",title:"ILS RWY 01 GP OTS FOR MAINT",eff:"Jan 10",exp:"Jan 12",stat:"Expired",text:"KMTC ILS RWY 01 GLIDEPATH OUT OF SERVICE."},
];
const CHECKS=[
  {id:"AC-0098",type:"FOD",date:"Today 0715L",who:"TSgt Williams",area:"RWY 01/19",result:"2 FOUND",data:"Items: Metal bolt (1/4\") near TWY A, rubber fragment (3\") midfield. Weather: Clear 28°F 310/08."},
  {id:"AC-0097",type:"BASH",date:"Today 0645L",who:"MSgt Proctor",area:"Full Airfield",result:"LOW",data:"Species: Canada geese (4, grazing N side), Red-tailed hawk (1, perched). Dispersal: Vehicle horn hazed geese."},
  {id:"AC-0096",type:"RCR",date:"Yesterday 1445L",who:"SrA Martinez",area:"RWY 01/19",result:"AVG Mu: 64",data:"Rollout: 66 | Mid: 60 | Departure: 66 | Avg: 64. Equipment: RT3 Flight @ 40 kts. Source: rt3grip.com."},
  {id:"AC-0095",type:"RSC",date:"Feb 5 0630L",who:"TSgt Williams",area:"RWY 01/19",result:"Frost",data:"Contaminant: Frost, Trace depth, 40% coverage. Treatment: KAc applied. Cleared by 0730L."},
  {id:"AC-0094",type:"Emergency",date:"Feb 4 1422L",who:"MSgt Proctor",area:"RWY 01",result:"IFE",data:"KC-135R BOLT 31, hydraulic failure. 42 min duration. All AM actions completed. Landed safely. Runway inspected and released."},
];
const INSP_ITEMS=[
  {sec:"Runway",items:["Surface condition (FOD/damage)","Markings visible & adequate","Edge lights operational","Threshold lights operational","PAPI/VASI operational"]},
  {sec:"Taxiway",items:["Surface condition","Markings visible","Edge lights operational","Hold short markings/signs"]},
  {sec:"Approach/Departure",items:["Approach light systems","Clear zones free of obstructions","NAVAID areas secured"]},
  {sec:"Support",items:["Overrun areas","Drainage systems","Perimeter fence","Wind indicators"]},
];

const C={bg:"#04070C",card:"rgba(10,16,28,0.92)",brd:"rgba(56,189,248,0.06)",ba:"rgba(56,189,248,0.2)",blue:"#38BDF8",bd:"#0369A1",green:"#34D399",red:"#EF4444",yel:"#FBBF24",org:"#F97316",pur:"#A78BFA",cyan:"#22D3EE",t1:"#F1F5F9",t2:"#94A3B8",t3:"#64748B",t4:"#334155"};
const sevC={Critical:C.red,High:C.org,Medium:C.yel,Low:C.blue};
const stC={Open:C.red,Assigned:C.org,"In Progress":C.yel,"Pending Parts":C.pur,Resolved:C.green,Closed:C.t3};
const ckC={FOD:C.yel,BASH:C.pur,RCR:C.cyan,RSC:C.blue,Emergency:C.red};
const ckI={FOD:"⚠️",BASH:"🦅",RCR:"📊",RSC:"❄️",Emergency:"🚨"};
const B=({l,c,bg})=><span style={{background:bg||`${c}1A`,color:c,padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:700,letterSpacing:"0.04em",whiteSpace:"nowrap"}}>{l}</span>;

export default function App(){
  const[scr,setScr]=useState("home");
  const[hist,setHist]=useState([]);
  const[sel,setSel]=useState(null);
  const[flt,setFlt]=useState("all");
  const[toast,setToast]=useState(null);
  const[inspState,setInspState]=useState({});
  const[emergState,setEmergState]=useState({});
  const[formType,setFormType]=useState(null);
  const[time,setTime]=useState("");
  const[syncAnim,setSyncAnim]=useState(false);

  useEffect(()=>{const t=setInterval(()=>setTime(new Date().toTimeString().slice(0,5)),1000);return()=>clearInterval(t)},[]);

  const go=(s,d)=>{setHist(h=>[...h,{scr,sel,flt}]);setScr(s);setSel(d||null);setFlt("all")};
  const bk=()=>{const h=[...hist];const p=h.pop()||{scr:"home"};setHist(h);setScr(p.scr);setSel(p.sel||null);setFlt(p.flt||"all")};
  const tt=(m)=>{setToast(m);setTimeout(()=>setToast(null),2000)};
  const doSync=()=>{setSyncAnim(true);setTimeout(()=>{setSyncAnim(false);tt("Sync complete — 9 records")},1500)};

  const s={
    r:{fontFamily:"'Outfit',-apple-system,sans-serif",background:C.bg,color:C.t1,minHeight:"100vh",maxWidth:480,margin:"0 auto"},
    c:{background:C.card,border:`1px solid ${C.brd}`,borderRadius:10,padding:14,marginBottom:8},
    l:{fontSize:9,fontWeight:700,color:C.t3,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:8,display:"block"},
    bk:{background:"none",border:"none",color:C.cyan,fontSize:12,fontWeight:600,cursor:"pointer",padding:0,marginBottom:12,fontFamily:"inherit"},
    pg:{padding:16,paddingBottom:100},
    tb:{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(4,7,12,0.97)",borderTop:`1px solid ${C.brd}`,display:"flex",justifyContent:"space-around",padding:"6px 0 20px",zIndex:100,backdropFilter:"blur(24px)"},
    btn:(c=C.blue)=>({background:`${c}14`,border:`1px solid ${c}33`,borderRadius:8,padding:"10px",color:c,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}),
    inp:{background:"rgba(4,8,14,0.9)",border:`1px solid ${C.brd}`,borderRadius:6,padding:"8px 10px",color:C.t1,fontSize:12,width:"100%",fontFamily:"inherit",boxSizing:"border-box"},
  };

  // HEADER
  const Hdr=()=>(
    <div style={{background:"linear-gradient(180deg,#0A1220,#070D18)",borderBottom:`1px solid ${C.brd}`,padding:"12px 16px 10px",position:"sticky",top:0,zIndex:50}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:`linear-gradient(135deg,#0C4A6E,${C.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,boxShadow:"0 0 16px rgba(56,189,248,0.15)"}}>✈️</div>
          <div><div style={{fontSize:15,fontWeight:800,letterSpacing:"-0.02em",background:`linear-gradient(135deg,${C.t1},${C.blue})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AIRFIELD OPS</div><div style={{fontSize:9,color:C.t3,fontWeight:600,letterSpacing:"0.12em"}}>SELFRIDGE ANGB • KMTC</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={doSync} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,padding:2,transition:"transform 0.3s",transform:syncAnim?"rotate(360deg)":"none"}}>🔄</button>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/>
        </div>
      </div>
    </div>
  );

  // HOME
  const Home=()=>{
    const op=DISC.filter(d=>!["Resolved","Closed"].includes(d.stat)).length;
    const cr=DISC.filter(d=>d.sev==="Critical"&&d.stat!=="Closed").length;
    const ov=DISC.filter(d=>d.days>7&&!["Resolved","Closed"].includes(d.stat)).length;
    return(<div style={s.pg}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:22,fontWeight:800}}>{time||"08:15"}</span>
        <span style={{fontSize:10,color:C.t3}}>MSgt Proctor • Online</span>
      </div>
      {/* Weather */}
      <div style={{...s.c,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(56,189,248,0.03)",border:`1px solid rgba(56,189,248,0.1)`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>☀️</span><div><div style={{fontSize:13,fontWeight:700}}>28°F • Clear</div><div style={{fontSize:10,color:C.t3}}>Wind 310/08 • Vis 10SM • Alt 30.12</div></div></div>
        <B l="ADVISORY" c={C.yel}/>
      </div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
        {[{l:"OPEN",v:op,c:C.yel,a:"disc"},{l:"CRITICAL",v:cr,c:cr>0?C.red:C.green,a:"disc"},{l:"OVERDUE",v:ov,c:ov>0?C.red:C.green,a:"disc"},{l:"NOTAMS",v:NOTAMS.filter(n=>n.stat==="Active").length,c:C.pur,a:"notams"}].map((k,i)=>(
          <div key={i} onClick={()=>go(k.a)} style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:10,padding:"10px 6px",textAlign:"center",cursor:"pointer"}}>
            <div style={{fontSize:9,color:C.t3,letterSpacing:"0.08em",fontWeight:600}}>{k.l}</div>
            <div style={{fontSize:22,fontWeight:800,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>
      {/* Quick Actions */}
      <span style={s.l}>Quick Actions</span>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
        {[
          {l:"New Discrep",i:"➕",c:C.red,a:()=>go("disc_form")},
          {l:"FOD Check",i:"⚠️",c:C.yel,a:()=>{setFormType("FOD");go("check_form")}},
          {l:"BASH Check",i:"🦅",c:C.pur,a:()=>{setFormType("BASH");go("check_form")}},
          {l:"RCR Reading",i:"📊",c:C.cyan,a:()=>{setFormType("RCR");go("check_form")}},
          {l:"RSC Report",i:"❄️",c:C.blue,a:()=>{setFormType("RSC");go("check_form")}},
          {l:"Emergency",i:"🚨",c:C.red,a:()=>go("emergency")},
          {l:"Inspection",i:"📋",c:C.green,a:()=>go("inspection")},
          {l:"NOTAM",i:"📡",c:C.pur,a:()=>go("notam_form")},
        ].map((q,i)=>(
          <button key={i} onClick={q.a} style={{background:C.card,border:`1px solid ${C.brd}`,borderRadius:10,padding:"12px 4px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}}>
            <div style={{width:28,height:28,borderRadius:7,background:`${q.c}12`,border:`1px solid ${q.c}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>{q.i}</div>
            <span style={{fontSize:8,color:C.t2,fontWeight:600,textAlign:"center",lineHeight:1.2}}>{q.l}</span>
          </button>
        ))}
      </div>
      {/* Today */}
      <span style={s.l}>Today's Status</span>
      <div style={{...s.c}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[["📋","Inspection","Not Started",C.yel,()=>go("inspection")],["⚠️","FOD","0715L (2 found)",C.yel,()=>go("check_d",CHECKS[0])],["🦅","BASH","0645L (LOW)",C.green,()=>go("check_d",CHECKS[1])],["📊","RCR","Yest (Mu 64)",C.yel,()=>go("check_d",CHECKS[2])]].map(([ic,lb,vl,cl,ac],i)=>(
            <div key={i} onClick={ac} style={{padding:"8px",background:"rgba(4,7,12,0.5)",borderRadius:8,cursor:"pointer",border:`1px solid ${C.brd}`}}>
              <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}><span style={{fontSize:11}}>{ic}</span><span style={{fontSize:9,color:C.t3,fontWeight:600}}>{lb}</span></div>
              <div style={{fontSize:11,fontWeight:700,color:cl}}>{vl}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Activity */}
      <span style={s.l}>Recent Activity</span>
      {[{t:"07:52",u:"TSgt Nakamura",x:"Updated D-2026-0041: parts ETA Monday",c:C.blue},{t:"07:45",u:"You",x:"Escalated D-2026-0042 to Critical",c:C.red},{t:"07:15",u:"TSgt Williams",x:"FOD check — 2 items found",c:C.yel},{t:"06:45",u:"You",x:"BASH check — LOW condition",c:C.pur}].map((a,i)=>(
        <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:i<3?`1px solid ${C.brd}`:"none"}}>
          <div style={{width:24,height:24,borderRadius:6,background:`${a.c}12`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>•</div>
          <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:700,color:a.u==="You"?C.cyan:C.t1}}>{a.u}</span><span style={{fontSize:9,color:C.t3}}>{a.t}</span></div><div style={{fontSize:10,color:C.t2}}>{a.x}</div></div>
        </div>
      ))}
    </div>)};

  // DISCREPANCIES
  const DiscL=()=>{
    const f=flt==="all"?DISC:DISC.filter(d=>d.stat===flt||d.sev===flt);
    return(<div style={s.pg}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={{fontSize:16,fontWeight:800}}>Discrepancies</div>
        <button onClick={()=>go("disc_form")} style={{background:`linear-gradient(135deg,${C.bd},#0EA5E9)`,border:"none",borderRadius:8,padding:"7px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ New</button>
      </div>
      <div style={{display:"flex",gap:3,marginBottom:12,overflowX:"auto",paddingBottom:4}}>
        {["all","Open","Assigned","In Progress","Critical"].map(v=>(
          <button key={v} onClick={()=>setFlt(v)} style={{background:flt===v?"rgba(34,211,238,0.12)":"transparent",border:`1px solid ${flt===v?"rgba(34,211,238,0.3)":C.brd}`,borderRadius:5,padding:"4px 8px",color:flt===v?C.cyan:C.t3,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{v==="all"?"All":v}</button>
        ))}
      </div>
      {f.map(d=>(
        <div key={d.id} onClick={()=>go("disc_d",d)} style={{...s.c,cursor:"pointer",borderLeft:`3px solid ${sevC[d.sev]}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:11,fontWeight:800,color:C.cyan}}>{d.id}</span>
            <div style={{display:"flex",gap:4}}><B l={d.sev} c={sevC[d.sev]}/><B l={d.stat} c={stC[d.stat]}/></div>
          </div>
          <div style={{fontSize:12,fontWeight:700}}>{d.title}</div>
          <div style={{fontSize:10,color:C.t3}}>{d.loc} • {d.shop} • {d.days>0?`${d.days}d open`:"Closed"}</div>
        </div>
      ))}
    </div>)};

  const DiscD=()=>{if(!sel)return null;const d=sel;return(<div style={s.pg}>
    <button onClick={bk} style={s.bk}>← Back</button>
    <div style={{...s.c,border:`1px solid ${sevC[d.sev]}33`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:16,fontWeight:800,color:C.cyan}}>{d.id}</span><div style={{display:"flex",gap:4}}><B l={d.sev} c={sevC[d.sev]}/><B l={d.stat} c={stC[d.stat]}/></div></div>
      <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>{d.title}</div>
      <div style={{fontSize:11,color:C.t2,lineHeight:1.6,marginBottom:12}}>{d.desc}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
        {[["Location",d.loc],["Type",d.sev],["Shop",d.shop],["Days Open",d.days>0?`${d.days}`:"Resolved"],["Photos",`${d.photos}`],["NOTAM",d.notam||"None"]].map(([l,v],i)=>(
          <div key={i}><div style={{fontSize:9,color:C.t3,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>{l}</div><div style={{fontWeight:500,marginTop:2}}>{v}</div></div>
        ))}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
      {[["✏️ Edit",C.blue],["📸 Photo",C.blue],["🔄 Status",C.yel],["📋 Work Order",C.green]].map(([l,c],i)=>(
        <button key={i} onClick={()=>tt(`${l} opened`)} style={s.btn(c)}>{l}</button>
      ))}
    </div>
    {d.notam&&<div onClick={()=>go("notam_d",NOTAMS.find(n=>n.id===d.notam))} style={{...s.c,marginTop:8,cursor:"pointer",borderLeft:`3px solid ${C.pur}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span style={s.l}>Linked NOTAM</span><span style={{fontSize:12,fontWeight:700,color:C.pur}}>{d.notam}</span></div><B l="VIEW →" c={C.cyan}/></div>
    </div>}
  </div>)};

  const DiscForm=()=>(<div style={s.pg}>
    <button onClick={bk} style={s.bk}>← Back</button>
    <div style={{fontSize:16,fontWeight:800,marginBottom:12}}>New Discrepancy</div>
    <div style={s.c}>
      {[["Title","text"],["Location","text"],["Type","select",["Pavement","Lighting","Markings","FOD","Signage","Drainage","NAVAID"]],["Severity","select",["Critical","High","Medium","Low"]],["Description","textarea"]].map(([l,t,o],i)=>(
        <div key={i} style={{marginBottom:12}}><span style={s.l}>{l}</span>
          {t==="select"?<select style={s.inp}>{o.map(x=><option key={x}>{x}</option>)}</select>
          :t==="textarea"?<textarea rows={3} style={{...s.inp,resize:"vertical"}}/>
          :<input type="text" style={s.inp}/>}
        </div>
      ))}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        <button onClick={()=>tt("📸 Camera opened")} style={s.btn(C.blue)}>📸 Add Photo</button>
        <button onClick={()=>tt("📍 GPS: 42.6128, -82.8319")} style={s.btn(C.green)}>📍 Capture GPS</button>
      </div>
      <button onClick={()=>{tt("Discrepancy saved!");bk()}} style={{background:`linear-gradient(135deg,${C.bd},#0EA5E9)`,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>Save Discrepancy</button>
    </div>
  </div>);

  // NOTAMS
  const NotamL=()=>{
    const f=flt==="all"?NOTAMS:NOTAMS.filter(n=>n.src===flt||n.stat===flt);
    return(<div style={s.pg}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div style={{fontSize:16,fontWeight:800}}>NOTAMs</div><button onClick={()=>go("notam_form")} style={{background:`linear-gradient(135deg,${C.bd},#0EA5E9)`,border:"none",borderRadius:8,padding:"7px 12px",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Draft</button></div>
      <div style={{...s.c,padding:"8px 12px",marginBottom:8,background:"rgba(34,211,238,0.03)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:C.green}}/><span style={{fontSize:10,color:C.green,fontWeight:600}}>FAA Feed Connected</span></div><span style={{fontSize:9,color:C.t3}}>Last: 06:50L</span></div>
      </div>
      <div style={{display:"flex",gap:3,marginBottom:12}}>
        {["all","FAA","LOCAL","Active","Expired"].map(v=>(<button key={v} onClick={()=>setFlt(v)} style={{background:flt===v?"rgba(34,211,238,0.12)":"transparent",border:`1px solid ${flt===v?"rgba(34,211,238,0.3)":C.brd}`,borderRadius:5,padding:"4px 8px",color:flt===v?C.cyan:C.t3,fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{v==="all"?"All":v}</button>))}
      </div>
      {f.map(n=>(<div key={n.id} onClick={()=>go("notam_d",n)} style={{...s.c,cursor:"pointer",borderLeft:`3px solid ${n.src==="FAA"?C.cyan:C.pur}`,opacity:n.stat==="Expired"?0.5:1}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div style={{display:"flex",gap:4}}><B l={n.src} c={n.src==="FAA"?C.cyan:C.pur}/><B l={n.type} c={C.t3}/></div><B l={n.stat} c={n.stat==="Active"?C.green:C.t3}/></div>
        <div style={{fontSize:12,fontWeight:700}}>{n.title}</div>
        <div style={{fontSize:9,color:C.t3,marginTop:2}}>Eff: {n.eff} • Exp: {n.exp}</div>
      </div>))}
    </div>)};

  const NotamD=()=>{if(!sel)return null;const n=sel;return(<div style={s.pg}>
    <button onClick={bk} style={s.bk}>← Back</button>
    <div style={s.c}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{display:"flex",gap:4}}><B l={n.src} c={n.src==="FAA"?C.cyan:C.pur}/><B l={n.stat} c={n.stat==="Active"?C.green:C.t3}/></div><span style={{fontSize:11,color:C.t3}}>{n.id}</span></div>
      <div style={{fontSize:15,fontWeight:800,marginBottom:8}}>{n.title}</div>
      <div style={{background:"rgba(4,7,12,0.5)",borderRadius:8,padding:12,fontFamily:"monospace",fontSize:11,color:C.t1,lineHeight:1.6,marginBottom:12}}>{n.text}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11}}>
        {[["Type",n.type],["Effective",n.eff],["Expires",n.exp],["Source",n.src]].map(([l,v],i)=>(<div key={i}><div style={{fontSize:9,color:C.t3,fontWeight:600,textTransform:"uppercase"}}>{l}</div><div style={{fontWeight:500,marginTop:2}}>{v}</div></div>))}
      </div>
    </div>
    {n.src==="LOCAL"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}><button onClick={()=>tt("Editing NOTAM")} style={s.btn(C.blue)}>✏️ Edit</button><button onClick={()=>tt("NOTAM cancelled")} style={s.btn(C.red)}>❌ Cancel</button></div>}
  </div>)};

  const NotamForm=()=>(<div style={s.pg}>
    <button onClick={bk} style={s.bk}>← Back</button>
    <div style={{fontSize:16,fontWeight:800,marginBottom:12}}>Draft NOTAM</div>
    <div style={s.c}>
      {[["Type","select",["Runway Closure","Taxiway Closure","Lighting","Construction","NAVAID","Custom"]],["Title","text"],["Full Text","textarea"],["Effective","date"],["Expires","date"]].map(([l,t,o],i)=>(
        <div key={i} style={{marginBottom:12}}><span style={s.l}>{l}</span>
          {t==="select"?<select style={s.inp}>{o.map(x=><option key={x}>{x}</option>)}</select>:t==="textarea"?<textarea rows={3} style={{...s.inp,resize:"vertical"}}/>:<input type={t==="date"?"date":"text"} style={s.inp}/>}
        </div>
      ))}
      <button onClick={()=>{tt("NOTAM draft saved");bk()}} style={{background:`linear-gradient(135deg,${C.bd},#0EA5E9)`,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>Save Draft</button>
    </div>
  </div>);

  // CHECKS
  const CheckL=()=>{
    const f=flt==="all"?CHECKS:CHECKS.filter(c=>c.type===flt);
    return(<div style={s.pg}>
      <div style={{fontSize:16,fontWeight:800,marginBottom:8}}>Airfield Checks</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:12}}>
        {["FOD","BASH","RCR","RSC","Emergency"].map(t=>(<div key={t} onClick={()=>setFlt(flt===t?"all":t)} style={{textAlign:"center",padding:"6px 2px",background:flt===t?`${ckC[t]}12`:C.card,borderRadius:6,border:`1px solid ${flt===t?`${ckC[t]}33`:C.brd}`,cursor:"pointer"}}>
          <div style={{fontSize:12}}>{ckI[t]}</div><div style={{fontSize:12,fontWeight:800,color:ckC[t]}}>{CHECKS.filter(c=>c.type===t).length}</div><div style={{fontSize:7,color:C.t3,fontWeight:600}}>{t}</div>
        </div>))}
      </div>
      {f.map(c=>(<div key={c.id} onClick={()=>go("check_d",c)} style={{...s.c,cursor:"pointer",borderLeft:`3px solid ${ckC[c.type]}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><div style={{display:"flex",gap:4}}><B l={c.type} c={ckC[c.type]}/><B l={c.result} c={c.result==="CLEAN"||c.result==="LOW"?C.green:ckC[c.type]}/></div><span style={{fontSize:9,color:C.t3}}>{c.id}</span></div>
        <div style={{fontSize:11,fontWeight:600}}>{c.area}</div><div style={{fontSize:10,color:C.t3}}>{c.date} • {c.who}</div>
      </div>))}
    </div>)};

  const CheckD=()=>{if(!sel)return null;const c=sel;return(<div style={s.pg}>
    <button onClick={bk} style={s.bk}>← Back</button>
    <div style={{...s.c,borderLeft:`3px solid ${ckC[c.type]}`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{display:"flex",gap:4}}><B l={c.type} c={ckC[c.type]}/><B l={c.result} c={c.result==="CLEAN"||c.result==="LOW"?C.green:ckC[c.type]}/></div><span style={{fontSize:11,color:C.t3}}>{c.id}</span></div>
      <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{c.area}</div>
      <div style={{fontSize:10,color:C.t3,marginBottom:10}}>{c.date} • {c.who}</div>
      <div style={{background:"rgba(4,7,12,0.5)",borderRadius:8,padding:12,fontSize:11,color:C.t2,lineHeight:1.6}}>{c.data}</div>
    </div>
  </div>)};

  const CheckForm=()=>(<div style={s.pg}>
    <button onClick={bk} style={s.bk}>← Back</button>
    <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>New {formType} Check</div>
    <div style={{fontSize:10,color:C.t3,marginBottom:12}}>{ckI[formType]} {formType==="FOD"?"Foreign Object Debris walk/drive":formType==="BASH"?"Bird/Animal Strike Hazard observation":formType==="RCR"?"Runway Condition Reading":formType==="RSC"?"Runway Surface Condition":"Emergency Response"}</div>
    <div style={s.c}>
      <div style={{marginBottom:12}}><span style={s.l}>Area</span><select style={s.inp}><option>RWY 01/19 Full Length</option><option>TWY A</option><option>TWY B</option><option>TWY C</option><option>Full Airfield</option></select></div>
      <div style={{marginBottom:12}}><span style={s.l}>Leader</span><input defaultValue="MSgt Proctor" style={s.inp}/></div>
      {formType==="FOD"&&<><div style={{marginBottom:12}}><span style={s.l}>FOD Items Found</span><textarea placeholder="One item per line..." rows={3} style={{...s.inp,resize:"vertical"}}/></div><button onClick={()=>tt("📸 Photo captured")} style={{...s.btn(C.blue),width:"100%",marginBottom:12}}>📸 Capture Photo</button></>}
      {formType==="BASH"&&<><div style={{marginBottom:12}}><span style={s.l}>Condition Code</span><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{["LOW","MODERATE","SEVERE"].map(c=><button key={c} onClick={()=>tt(`Set to ${c}`)} style={{padding:"10px",borderRadius:6,border:`1px solid ${c==="LOW"?C.green:c==="MODERATE"?C.yel:C.red}33`,background:`${c==="LOW"?C.green:c==="MODERATE"?C.yel:C.red}0A`,color:c==="LOW"?C.green:c==="MODERATE"?C.yel:C.red,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{c}</button>)}</div></div><div style={{marginBottom:12}}><span style={s.l}>Species Observed</span><textarea placeholder="Species, count, behavior..." rows={3} style={{...s.inp,resize:"vertical"}}/></div></>}
      {formType==="RCR"&&<><div style={{marginBottom:12}}><div style={{display:"flex",gap:6,marginBottom:8}}><button onClick={()=>tt("Syncing from rt3grip.com...")} style={{...s.btn(C.cyan),flex:1}}>🔄 Sync RT3</button><button onClick={()=>tt("File picker opened")} style={{...s.btn(C.blue),flex:1}}>📁 Import CSV</button></div><span style={s.l}>Mu Values by Thirds</span><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{["Rollout","Mid","Departure"].map(t=><div key={t}><div style={{fontSize:9,color:C.t3,marginBottom:4,textAlign:"center"}}>{t}</div><input type="number" placeholder="Mu" style={{...s.inp,textAlign:"center"}}/></div>)}</div></div><div style={{marginBottom:12}}><span style={s.l}>Equipment</span><select style={s.inp}><option>RT3 Flight</option><option>Bowmonk Mk3</option><option>Mu-Meter</option><option>GripTester</option></select></div></>}
      {formType==="RSC"&&<><div style={{marginBottom:12}}><span style={s.l}>Contaminant</span><select style={s.inp}>{["Dry Snow","Wet Snow","Compacted Snow","Ice","Slush","Standing Water","Frost","Wet","Dry"].map(c=><option key={c}>{c}</option>)}</select></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}><div><span style={s.l}>Depth</span><input placeholder="inches" style={s.inp}/></div><div><span style={s.l}>Coverage %</span><input type="number" placeholder="%" style={s.inp}/></div></div><div style={{marginBottom:12}}><span style={s.l}>Treatment</span><select style={s.inp}><option>None</option><option>KAc</option><option>Sodium Formate</option><option>Urea</option><option>Sand</option><option>Mechanical</option></select></div></>}
      <div style={{marginBottom:12}}><span style={s.l}>Notes</span><textarea rows={2} style={{...s.inp,resize:"vertical"}}/></div>
      <button onClick={()=>{tt(`${formType} check saved!`);bk()}} style={{background:`linear-gradient(135deg,${C.bd},#0EA5E9)`,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>Save {formType} Check</button>
    </div>
  </div>);

  // INSPECTION
  const Inspection=()=>{
    const total=INSP_ITEMS.reduce((s,sec)=>s+sec.items.length,0);
    const done=Object.keys(inspState).length;
    const pct=total>0?Math.round((done/total)*100):0;
    return(<div style={s.pg}>
      <button onClick={bk} style={s.bk}>← Back</button>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div><div style={{fontSize:16,fontWeight:800}}>Daily Inspection</div><div style={{fontSize:10,color:C.t3}}>DAFI 13-213 • {done}/{total} items</div></div>
        <div style={{width:44,height:44,borderRadius:22,background:`conic-gradient(${C.green} ${pct*3.6}deg, ${C.t4}40 0deg)`,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{width:36,height:36,borderRadius:18,background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:pct===100?C.green:C.t1}}>{pct}%</div></div>
      </div>
      {INSP_ITEMS.map((sec,si)=>{
        const secDone=sec.items.filter((_,ii)=>inspState[`${si}-${ii}`]).length;
        return(<div key={si} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:12,fontWeight:700,color:secDone===sec.items.length?C.green:C.t1}}>{sec.sec}</span>
            <span style={{fontSize:9,color:C.t3}}>{secDone}/{sec.items.length}</span>
          </div>
          {sec.items.map((item,ii)=>{
            const k=`${si}-${ii}`;const v=inspState[k];
            return(<div key={ii} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:2,background:C.card,borderRadius:6,border:`1px solid ${C.brd}`}}>
              <button onClick={()=>setInspState(p=>{const n={...p};if(!n[k])n[k]="pass";else if(n[k]==="pass")n[k]="fail";else delete n[k];return n})} style={{width:28,height:28,borderRadius:6,border:`2px solid ${!v?C.t4:v==="pass"?C.green:C.red}`,background:!v?"transparent":v==="pass"?"rgba(52,211,153,0.15)":"rgba(239,68,68,0.15)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,flexShrink:0,color:v==="pass"?C.green:v==="fail"?C.red:C.t4}}>{!v?"":v==="pass"?"✓":"✗"}</button>
              <span style={{fontSize:11,color:v==="pass"?C.green:v==="fail"?C.red:C.t1,flex:1}}>{item}</span>
              <span style={{fontSize:8,color:C.t3}}>{!v?"tap":v}</span>
            </div>)
          })}
        </div>)
      })}
      {pct===100&&<button onClick={()=>{tt("Inspection submitted!");bk()}} style={{background:`linear-gradient(135deg,${C.greenD},${C.green})`,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>✅ Submit Inspection</button>}
    </div>)};

  // EMERGENCY
  const Emergency=()=>{
    const actions=["Notified ATC/RAPCON","Activated crash phone net","Coordinated fire standby","Swept runway clear","Positioned AM vehicle","Verified arresting gear","Confirmed rescue route clear","Coordinated Wing Safety","Notified SOF/CP/MOC","Issued NOTAM (if needed)","Post: Inspected runway","Post: Released to ATC"];
    const done=Object.keys(emergState).length;
    return(<div style={s.pg}>
      <button onClick={bk} style={s.bk}>← Back</button>
      <div style={{fontSize:16,fontWeight:800,marginBottom:4,color:C.red}}>🚨 Emergency Response</div>
      <div style={{fontSize:10,color:C.t3,marginBottom:12}}>Airfield Manager Procedures</div>
      <div style={s.c}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          <div><span style={s.l}>Emergency Type</span><select style={s.inp}><option>In-Flight Emergency</option><option>Ground Emergency</option><option>Exercise/Drill</option></select></div>
          <div><span style={s.l}>Runway</span><select style={s.inp}><option>RWY 01</option><option>RWY 19</option></select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
          <div><span style={s.l}>Aircraft Type</span><input placeholder="KC-135R" style={s.inp}/></div>
          <div><span style={s.l}>Callsign</span><input placeholder="BOLT 31" style={s.inp}/></div>
        </div>
        <div style={{marginBottom:12}}><span style={s.l}>Nature</span><input placeholder="Hydraulic failure..." style={s.inp}/></div>
      </div>
      <span style={s.l}>AM Action Checklist ({done}/{actions.length})</span>
      {actions.map((a,i)=>(
        <div key={i} onClick={()=>setEmergState(p=>{const n={...p};if(n[i])delete n[i];else n[i]=true;return n})} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:2,background:C.card,borderRadius:6,border:`1px solid ${C.brd}`,cursor:"pointer"}}>
          <div style={{width:24,height:24,borderRadius:6,border:`2px solid ${emergState[i]?C.green:C.t4}`,background:emergState[i]?"rgba(52,211,153,0.15)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:C.green,flexShrink:0}}>{emergState[i]?"✓":""}</div>
          <span style={{fontSize:11,color:emergState[i]?C.green:C.t1}}>{i+1}. {a}</span>
        </div>
      ))}
      <div style={{marginTop:12}}><span style={s.l}>Notifications Sent</span>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {["SOF","Fire Chief","Wing Safety","MOC","Command Post","ATC","CE","Security","Medical"].map(n=>(
            <button key={n} onClick={()=>tt(`${n} notified`)} style={{padding:"6px 10px",borderRadius:6,background:"rgba(56,189,248,0.06)",border:`1px solid ${C.brd}`,color:C.t2,fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{n}</button>
          ))}
        </div>
      </div>
      <button onClick={()=>{tt("Emergency log saved");bk()}} style={{marginTop:12,background:`linear-gradient(135deg,${C.bd},#0EA5E9)`,color:"#fff",border:"none",borderRadius:8,padding:"12px",fontSize:13,fontWeight:700,cursor:"pointer",width:"100%",fontFamily:"inherit"}}>Save Emergency Log</button>
    </div>)};

  // MORE MENU
  const More=()=>(<div style={s.pg}>
    <div style={{fontSize:16,fontWeight:800,marginBottom:14}}>All Modules</div>
    {[
      {n:"Discrepancies",i:"📝",c:C.red,b:`${DISC.filter(d=>!["Resolved","Closed"].includes(d.stat)).length} open`,a:"disc"},
      {n:"Inspections",i:"📋",c:C.green,b:null,a:"inspection"},
      {n:"NOTAMs",i:"📡",c:C.pur,b:`${NOTAMS.filter(n=>n.stat==="Active").length} active`,a:"notams"},
      {n:"Airfield Checks",i:"🛡️",c:C.yel,b:null,a:"checks"},
      {n:"Obstructions",i:"🗺️",c:C.blue,b:null,a:"obstruction"},
      {n:"Reports",i:"📊",c:C.cyan,b:null,a:"reports"},
      {n:"Users & Security",i:"👥",c:C.t3,b:"3 online",a:"users"},
      {n:"Sync & Data",i:"🔄",c:C.cyan,b:"3 pending",a:"sync"},
      {n:"Settings",i:"⚙️",c:C.t3,b:null,a:"settings"},
    ].map(m=>(<div key={m.n} onClick={()=>{if(["obstruction","reports","users","sync","settings"].includes(m.a)){tt(`Opening ${m.n}...`)}else go(m.a)}} style={{...s.c,cursor:"pointer",display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:40,height:40,borderRadius:10,background:`${m.c}10`,border:`1px solid ${m.c}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{m.i}</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{m.n}</div></div>
      {m.b&&<B l={m.b} c={m.c}/>}
      <span style={{color:C.t4,fontSize:16}}>›</span>
    </div>))}
    <div style={{...s.c,marginTop:8,textAlign:"center",padding:16}}>
      <div style={{fontSize:11,fontWeight:700,color:C.t2}}>Airfield OPS Management Suite</div>
      <div style={{fontSize:10,color:C.t3}}>v1.0.0 • Phases 1–8 • 127th Wing</div>
    </div>
  </div>);

  // TAB BAR
  const Tab=({i,l,t,alert})=>(<button onClick={()=>{setScr(t);setSel(null);setFlt("all");setHist([])}} style={{background:"none",border:"none",color:scr===t?C.cyan:C.t3,display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",padding:"4px 8px",position:"relative"}}><span style={{fontSize:20}}>{i}</span><span style={{fontSize:8,fontWeight:700,letterSpacing:"0.08em"}}>{l}</span>{alert&&<div style={{position:"absolute",top:0,right:4,width:7,height:7,borderRadius:4,background:C.red}}/>}</button>);

  return(<div style={s.r}>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
    <Hdr/>
    {toast&&<div style={{position:"fixed",top:70,left:"50%",transform:"translateX(-50%)",background:"rgba(52,211,153,0.95)",borderRadius:10,padding:"10px 20px",zIndex:300,fontSize:12,fontWeight:700,color:"#042F2E",boxShadow:"0 10px 40px rgba(0,0,0,0.4)",whiteSpace:"nowrap"}}>✅ {toast}</div>}
    {scr==="home"&&<Home/>}
    {scr==="disc"&&<DiscL/>}
    {scr==="disc_d"&&<DiscD/>}
    {scr==="disc_form"&&<DiscForm/>}
    {scr==="notams"&&<NotamL/>}
    {scr==="notam_d"&&<NotamD/>}
    {scr==="notam_form"&&<NotamForm/>}
    {scr==="checks"&&<CheckL/>}
    {scr==="check_d"&&<CheckD/>}
    {scr==="check_form"&&<CheckForm/>}
    {scr==="inspection"&&<Inspection/>}
    {scr==="emergency"&&<Emergency/>}
    {scr==="more"&&<More/>}
    <div style={s.tb}>
      <Tab i="🏠" l="HOME" t="home" alert/>
      <Tab i="📝" l="DISCREP" t="disc"/>
      <Tab i="🛡️" l="CHECKS" t="checks"/>
      <Tab i="📡" l="NOTAMS" t="notams"/>
      <Tab i="☰" l="MORE" t="more"/>
    </div>
  </div>);
}
