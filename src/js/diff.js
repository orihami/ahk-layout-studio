"use strict";
function diffLines(a, b){
  let s=0; while(s<a.length && s<b.length && a[s]===b[s]) s++;
  let ea=a.length, eb=b.length; while(ea>s && eb>s && a[ea-1]===b[eb-1]){ ea--; eb--; }
  const A=a.slice(s,ea), B=b.slice(s,eb), n=A.length, m=B.length;
  const ops=[];
  for(let i=0;i<s;i++) ops.push([' ',a[i],i+1]);
  if(n*m > 4e6){ A.forEach(x=>ops.push(['-',x])); B.forEach(x=>ops.push(['+',x])); }
  else {
    const W=m+1, dp=new Uint32Array((n+1)*W);
    for(let i=n-1;i>=0;i--) for(let j=m-1;j>=0;j--) dp[i*W+j] = A[i]===B[j] ? dp[(i+1)*W+j+1]+1 : Math.max(dp[(i+1)*W+j], dp[i*W+j+1]);
    let i=0,j=0;
    while(i<n||j<m){
      if(i<n&&j<m&&A[i]===B[j]){ ops.push([' ',A[i]]); i++; j++; }
      else if(j<m && (i>=n || dp[i*W+j+1]>=dp[(i+1)*W+j])){ ops.push(['+',B[j]]); j++; }
      else { ops.push(['-',A[i]]); i++; }
    }
  }
  for(let i=ea;i<a.length;i++) ops.push([' ',a[i]]);
  // 新ファイルの行番号
  let ln=0; for(const o of ops){ if(o[0]!=='-'){ ln++; o[2]=ln; } else o[2]=''; }
  return ops;
}
function diffHTML(a, b){
  const ops = diffLines(a.split(/\r?\n/), b.split(/\r?\n/));
  const keep = new Set(); ops.forEach((o,i)=>{ if(o[0]!==' ') for(let k=i-2;k<=i+2;k++) keep.add(k); });
  let h='', last=-1;
  ops.forEach((o,i)=>{ if(!keep.has(i)) return; if(last>=0 && i>last+1) h+=`<div class="dl sep">⋯</div>`; last=i;
    h+=`<div class="dl ${o[0]==='+'?'add':o[0]==='-'?'del':''}"><span class="ln">${o[2]}</span>${o[0]===' '?'&nbsp;':o[0]} ${esc(o[1])}</div>`; });
  return h || '<div class="dim" style="padding:8px">変更なし</div>';
}
