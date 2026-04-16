"use client";
import { signIn } from "next-auth/react";

export default function SignIn() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f8fafc", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:12, padding:"40px 48px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", textAlign:"center", maxWidth:360 }}>
        <div style={{ fontSize:28, fontWeight:700, color:"#0f172a", marginBottom:8 }}>Anrok E-Invoicing</div>
        <div style={{ fontSize:14, color:"#64748b", marginBottom:32 }}>Sign in with your Anrok Google account to continue.</div>
        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          style={{ width:"100%", padding:"12px 20px", background:"#1d4ed8", color:"#fff", border:"none", borderRadius:8, fontSize:15, fontWeight:600, cursor:"pointer" }}
        >
          Sign in with Google
        </button>
        <div style={{ fontSize:12, color:"#94a3b8", marginTop:16 }}>@anrok.com accounts only</div>
      </div>
    </div>
  );
}
