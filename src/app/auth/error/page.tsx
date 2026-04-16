"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ErrorContent() {
  const params = useSearchParams();
  const error  = params.get("error");
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f8fafc", fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:12, padding:"40px 48px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", textAlign:"center", maxWidth:360 }}>
        <div style={{ fontSize:20, fontWeight:700, color:"#dc2626", marginBottom:8 }}>Access Denied</div>
        <div style={{ fontSize:14, color:"#64748b", marginBottom:24 }}>
          {error === "AccessDenied"
            ? "Only @anrok.com Google accounts can access this tool."
            : "An error occurred during sign in. Please try again."}
        </div>
        <a href="/auth/signin" style={{ color:"#1d4ed8", fontSize:14, fontWeight:600 }}>← Back to sign in</a>
      </div>
    </div>
  );
}

export default function AuthError() {
  return <Suspense><ErrorContent /></Suspense>;
}
