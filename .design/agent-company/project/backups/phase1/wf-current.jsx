// Current state — recreates the existing CEO Chat dashboard in the wireframe palette.
// Acts as the baseline to compare the proposed variants against.

function CurrentDashboard() {
  return (
    <div className="wf" style={{flexDirection:"row"}}>
      <VariantTag>Current · CEO Chat (today)</VariantTag>
      <MissionRail />

      {/* Dashboard column */}
      <div style={{
        width: 280,
        background: "var(--paper-2)",
        borderRight: "1.5px solid var(--rule)",
        display: "flex", flexDirection: "column",
        flex: "0 0 auto",
      }}>
        <div style={{padding:"14px 16px 12px",borderBottom:"1.5px solid var(--rule)",display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",gap:1.5,alignItems:"flex-end",height:18}}>
            <span style={{width:4,height:14,background:"var(--pm)",borderRadius:1}} />
            <span style={{width:4,height:11,background:"var(--paper)",border:"1px solid var(--rule)",borderRadius:1}} />
            <span style={{width:4,height:16,background:"var(--approve)",borderRadius:1}} />
            <span style={{width:4,height:9, background:"var(--review)",borderRadius:1}} />
          </div>
          <span style={{fontSize:15,fontWeight:700}}>Dashboard</span>
        </div>

        <div style={{flex:1,overflow:"auto",padding:"10px 12px 18px"}}>
          {/* Workspace card — with expand affordance + add new workspace */}
          <div className="box" style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:10,background:"var(--paper)"}}>
            <span style={{color:"var(--ink-3)"}}>📁</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:9,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Workspace</div>
              <div style={{fontSize:13,fontWeight:500,color:"var(--ink-2)"}}>Open Folder…</div>
            </div>
            <span style={{color:"var(--ink-3)",fontSize:12}}>⌄</span>
          </div>

          {/* Project Files */}
          <div style={{marginTop:16}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 4px",marginBottom:6}}>
              <span style={{color:"var(--ink-3)",fontSize:10}}>⌄</span>
              <span style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>Project Files</span>
              <span style={{marginLeft:"auto",color:"var(--ink-3)",fontSize:11,cursor:"pointer"}} title="refresh">↻</span>
            </div>
          </div>

          {/* Sessions */}
          <div style={{marginTop:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 4px",marginBottom:6}}>
              <span style={{color:"var(--ink-3)",fontSize:10}}>⌄</span>
              <span style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>Sessions</span>
              <span style={{marginLeft:"auto",color:"var(--approve)",fontSize:14,fontWeight:600,cursor:"pointer",lineHeight:1}}>＋</span>
            </div>
            <div style={{padding:"0 4px",display:"flex",flexDirection:"column",gap:2}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",fontSize:13,color:"var(--ink-2)"}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"var(--worker)"}} />
                Default Session
              </div>
            </div>
          </div>

          {/* Departments */}
          <div style={{marginTop:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 4px",marginBottom:6}}>
              <span style={{color:"var(--ink-3)",fontSize:10}}>⌄</span>
              <span style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>Departments</span>
            </div>
            <div style={{padding:"0 4px",display:"flex",flexDirection:"column",gap:6}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,padding:"2px 6px"}}>Frontend Dept</div>
                <div style={{fontSize:12,color:"var(--ink-3)",padding:"0 6px 0 18px"}}>- ui-worker</div>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:700,padding:"2px 6px"}}>Backend Dept</div>
                <div style={{fontSize:12,color:"var(--ink-3)",padding:"0 6px 0 18px"}}>- api-worker</div>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div style={{marginTop:14}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 4px",marginBottom:6}}>
              <span style={{color:"var(--ink-3)",fontSize:10}}>⌄</span>
              <span style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>Skills</span>
              <span style={{marginLeft:"auto",color:"var(--approve)",fontSize:14,fontWeight:600,cursor:"pointer",lineHeight:1}}>＋</span>
            </div>
            <div className="box" style={{padding:"10px 12px",background:"var(--paper)",display:"flex",flexDirection:"column",gap:8}}>
              <div>
                <div style={{fontSize:9,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700,marginBottom:3}}>Universal</div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"var(--ink-2)"}}>
                  <span style={{color:"var(--approve)",fontWeight:700}}>✓</span> TDD-Expert
                </div>
              </div>
              <div>
                <div style={{fontSize:9,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700,marginBottom:3}}>Task Pool</div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"var(--ink-2)"}}>
                  <span style={{width:5,height:5,background:"var(--ink-3)",borderRadius:"50%",display:"inline-block"}} /> Cloud-Deploy
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main pane */}
      <div style={{flex:1,background:"var(--paper)",display:"flex",flexDirection:"column",padding:"18px 22px",gap:14,minHeight:0,overflow:"hidden"}}>
        {/* CEO Chat card */}
        <div className="box" style={{display:"flex",flexDirection:"column",overflow:"hidden",flex:"0 0 auto",minHeight:0}}>
          <div style={{padding:"14px 18px",borderBottom:"1.5px solid var(--rule)",display:"flex",alignItems:"center",gap:12,background:"var(--paper-2)"}}>
            <div style={{width:36,height:36,borderRadius:8,background:"var(--approve)",color:"var(--paper)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,letterSpacing:0.5}}>CEO</div>
            <div style={{fontSize:15,fontWeight:700}}>CEO Agent (Project Orchestrator)</div>
          </div>
          <div style={{padding:"20px 18px",minHeight:260,background:"var(--paper)"}}>
            <div style={{background:"var(--paper-2)",border:"1px solid var(--rule-soft)",borderRadius:8,padding:"12px 16px",width:"fit-content",maxWidth:"100%",fontSize:13,color:"var(--ink)",lineHeight:1.5}}>
              Welcome, CEO. I'm ready to orchestrate your project. What's our main objective for today?
            </div>
          </div>
          <div style={{padding:"0 18px 16px"}}>
            <div className="composer" style={{padding:"10px 12px"}}>
              <span style={{color:"var(--ink-3)"}}>Discuss project roadmap with CEO…</span>
              <span className="send">➤</span>
            </div>
          </div>
        </div>

        {/* Active Missions */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"2px 4px",fontFamily:"var(--mono)",fontSize:11,letterSpacing:1.2,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>
          <span style={{fontFamily:"var(--mono)"}}>&gt;_</span>
          <span>Active Missions</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div className="box-soft" style={{padding:"16px 18px",minHeight:64,background:"var(--paper-2)"}}>
            <div style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>Proposed</div>
          </div>
          <div className="box-soft" style={{padding:"16px 18px",minHeight:64,background:"var(--paper-2)"}}>
            <div style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>Executing</div>
          </div>
        </div>

        {/* note */}
        <div style={{marginTop:"auto",display:"flex",alignItems:"center",gap:6,padding:"4px 4px",fontFamily:"var(--hand)",fontSize:14,color:"var(--ink-3)"}}>
          ↑ this is the current page · proposals below build on top
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CurrentDashboard });
