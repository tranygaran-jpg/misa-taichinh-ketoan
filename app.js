/* Linked SVG dashboards backed by an identity-free customer cohort cube. */
const C = {
  navy:"#13528c", navyDeep:"#10477b", blue:"#1985c8", sky:"#91c6e9",
  pale:"#d8eaf7", orange:"#f2a17d", orangePale:"#f9c4a4", gray:"#d7e7f1",
  grid:"#e5f0f8", label:"#527d9c"
};
const PRODUCT = {A:"AMIS Kế toán", B:"meInvoice", C:"eSign", D:"mTax", E:"JetPay BankHub"};
const nf = (v, digits=0) => new Intl.NumberFormat("vi-VN",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(v);
const pct = (n,d, digits=1) => d ? nf(100*n/d,digits)+"%" : "—";
const esc = s => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
let DATA, COHORTS, SEQUENCE_SUMMARY;
const state = {view:1, combo:"12", segment:"all", filters:{
  year:2025,size:"",industry:"",city:"",product:"",count:"",
  combo:"",ab:"",role:null,purchaseType:"",revenueClass:"",
  aSubset:false,productStatus:null
}};
const descriptions = {
  1:["DASHBOARD 1 – Cơ cấu khách hàng theo sản phẩm và tổ hợp mua","Khách hàng đã mua sản phẩm nào, mua riêng hay theo tổ hợp nào?"],
  2:["DASHBOARD 2 – Thực trạng mua kết hợp và mua bổ sung","Khách hàng mua cùng lúc hay bổ sung sản phẩm theo thời gian?"],
  3:["DASHBOARD 3 – DOANH SỐ VÀ MỨC ĐỘ MUA BỔ SUNG SẢN PHẨM","Cơ cấu doanh số, giá trị giao dịch mua bổ sung và khoảng trống mua sản phẩm."]
};

function kpi(label,value,unit="",foot="",variant="") {
  return `<article class="kpi ${variant}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}${unit ? `<span class="unit">${unit}</span>`:""}</div><div class="kpi-foot">${foot||"&nbsp;"}</div></article>`;
}
function card(title,subtitle,body,cl="chart-half",control="") {
  const chartNumber=(title.match(/^\d+/)||["01"])[0];
  return `<section class="card ${cl}"><div class="card-head"><div class="card-heading"><h2 class="card-title">${title}</h2><div class="card-sub">${subtitle}</div></div><div class="chart-controls">${control}<button type="button" class="detail-button" data-detail="${state.view}-${chartNumber}" title="Phóng lớn và xem phân tích ${esc(title)}">↗ Phân tích</button></div></div><div class="card-body">${body}</div></section>`;
}
function legend(items) {
  return `<div class="chart-legend">${items.map(([color,label])=>`<span class="legend-item"><i class="swatch" style="background:${color}"></i>${label}</span>`).join("")}</div>`;
}
function hBars(items,denom,maxValue,single=false) {
  const max=Math.max(1,maxValue||Math.max(...items.map(x=>x.n)));
  return `<div class="horizontal-bars">${items.map(({code,n})=>`<div class="hbar-row chart-clickable" data-filter="${single?"single":"product"}:${code}" tabindex="0" role="button" aria-label="${single?"Lọc khách chỉ mua":"Lọc khách đã mua"} ${esc(PRODUCT[code])}">
    <div class="hbar-label">${code} · ${PRODUCT[code]}<small>${single?"Chỉ mua sản phẩm này":"Đã từng mua"}</small></div>
    <div class="hbar-track" data-tip="${esc(PRODUCT[code]+": "+nf(n)+" KH")}"><div class="hbar-fill" style="width:${Math.max(2,100*n/max)}%"></div></div>
    <div class="hbar-value">${nf(n)}<small>${pct(n,denom)}</small></div>
  </div>`).join("")}</div>`;
}
function donut(segments,total,centerTop,centerBottom,filterKind="") {
  const circumference=2*Math.PI*73;
  let cumulative=0;
  const rings=segments.map(item=>{
    const len=item.n/Math.max(total,1)*circumference;
    const attr=filterKind&&item.filter?`data-filter="${filterKind}:${esc(item.filter)}" tabindex="0" role="button"`:"";
    const output=`<circle cx="110" cy="110" r="73" fill="none" stroke="${item.color}" stroke-width="31" stroke-dasharray="${Math.max(0,len-2)} ${circumference}" stroke-dashoffset="${-cumulative}" transform="rotate(-90 110 110)" ${attr} data-tip="${esc(item.label+": "+nf(item.n)+" KH · "+pct(item.n,total))}"/>`;
    cumulative+=len;
    return output;
  }).join("");
  return `<div class="donut-layout">
    <div class="donut-wrap"><svg viewBox="0 0 220 220" class="chart-svg" role="img" aria-label="Biểu đồ donut cơ cấu khách hàng">
      <circle cx="110" cy="110" r="73" fill="none" stroke="#edf2f9" stroke-width="31"/>${rings}
      <text x="110" y="111" text-anchor="middle" fill="#173760" font-weight="800" font-size="25">${centerTop}</text>
      <text x="110" y="133" text-anchor="middle" fill="#8a9ab1" font-weight="600" font-size="10.5">${centerBottom}</text>
    </svg></div>
    <div class="donut-legend">${segments.map(s=>`<div class="item" ${filterKind&&s.filter?`data-filter="${filterKind}:${esc(s.filter)}" tabindex="0" role="button"`:""}><i class="swatch" style="background:${s.color}"></i>
      <span class="legend-label">${s.label}<span class="legend-pct">${pct(s.n,total)}</span></span>
      <strong class="legend-value">${nf(s.n)}</strong></div>`).join("")}</div>
  </div>`;
}
function upset(items) {
  const chosen=state.combo==="all"?items:items.slice(0,12);
  if(!chosen.length)return '<div class="no-data">Không có tổ hợp phù hợp với bộ lọc</div>';
  const step=48, left=75, width=Math.max(620,left+chosen.length*step+15), h=240;
  const mx=Math.max(...chosen.map(x=>x.count));
  const rows="ABCDE".split("");
  const dots=chosen.map(({code,count},i)=>{
    const x=left+i*step+24, barH=count/mx*78, ybar=110-barH;
    const active=rows.map((c,ri)=>code.includes(c)?144+ri*17:null).filter(x=>x!==null);
    const connector=active.length>1?`<line x1="${x}" y1="${Math.min(...active)}" x2="${x}" y2="${Math.max(...active)}" stroke="${C.navyDeep}" stroke-width="2.7"/>`:"";
    return `<g data-filter="combo:${code}" tabindex="0" role="button" data-tip="${esc("Đúng tổ hợp "+code+": "+nf(count)+" khách hàng · Bấm để lọc")}">
      <rect x="${x-11}" y="${ybar}" width="22" height="${barH}" rx="4" fill="${code.length===2?C.blue:C.navy}" />
      <text x="${x}" y="${ybar-7}" text-anchor="middle" class="svg-value" font-size="10.5">${nf(count)}</text>
      ${connector}
      ${rows.map((r,ri)=>`<circle cx="${x}" cy="${144+ri*17}" r="${code.includes(r)?4.4:3.3}" fill="${code.includes(r)?C.navyDeep:"#dee6f0"}"/>`).join("")}
      <text x="${x}" y="234" text-anchor="middle" class="svg-small" font-weight="700">${code}</text>
    </g>`;
  }).join("");
  return `<div class="upset-scroll"><svg style="width:${state.combo==="all"?width+"px":"100%"}" viewBox="0 0 ${width} ${h}" role="img" aria-label="Ma trận UpSet số khách hàng theo tổ hợp sản phẩm">
    <text x="9" y="19" class="svg-small">Số KH</text>
    <line x1="66" x2="${width-10}" y1="113" y2="113" class="axis-line"/>
    <line x1="66" x2="${width-10}" y1="134" y2="134" class="axis-line"/>
    ${rows.map((r,ri)=>`<text x="48" y="${148+ri*17}" text-anchor="end" class="svg-label">${r}</text>
       <line x1="65" x2="${width-10}" y1="${144+ri*17}" y2="${144+ri*17}" stroke="#f4f6fa" stroke-width="1"/>`).join("")}
    ${dots}
  </svg></div>`;
}
function stackedYears(rows) {
  const W=700,H=264,left=55,base=227,top=40,max=Math.max(100,Math.ceil(Math.max(...rows.map(r=>r.initialOnly+r.initialThen+r.singleThen))*1.08/100)*100);
  let out=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Cột chồng ba nhóm hành vi mua sản phẩm theo năm">
    ${Array.from({length:6},(_,i)=>max*i/5).map(t=>`<line x1="${left}" x2="682" y1="${base-(t/max)*(base-top)}" y2="${base-(t/max)*(base-top)}" class="grid-line"/>
       <text x="44" y="${base-(t/max)*(base-top)+3}" text-anchor="end" class="svg-tick">${nf(t)}</text>`).join("")}
    ${legendSVG([[C.navy,"Kết hợp đầu, không mua thêm"],[C.orange,"Kết hợp đầu, có mua thêm"],[C.sky,"Một SP đầu, mua thêm"]],66,14)}
  `;
  rows.forEach((r,i)=>{
    const x=125+i*193,w=106,groups=[
      ["initialOnly",r.initialOnly,C.navy,"Kết hợp ngay lần đầu, không mua thêm","#fff"],
      ["initialThen",r.initialThen,C.orange,"Kết hợp ngay lần đầu, sau đó mua thêm","#543518"],
      ["singleThen",r.singleThen,C.sky,"Mua một sản phẩm ban đầu, sau đó mua thêm","#174c79"]
    ];
    let y=base;
    const total=r.initialOnly+r.initialThen+r.singleThen;
    out+=`<g data-tip="${r.year}: ${nf(r.initialOnly)} kết hợp đầu không mua thêm; ${nf(r.initialThen)} kết hợp đầu và mua bổ sung; ${nf(r.singleThen)} từ một SP đầu mua bổ sung. Tổng ${nf(total)} KH">`;
    for(const [code,count,color,label,textColor] of groups) {
      const h=count/max*(base-top);y-=h;
      out+=`<rect data-filter="purchaseType:${code}:${r.year}" tabindex="0" role="button" x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${color}" data-tip="${r.year}: ${label}: ${nf(count)} KH"/>
        ${h>13?`<text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle" font-size="11.5" font-weight="800" fill="${textColor}" pointer-events="none">${nf(count)}</text>`:""}`;
    }
    out+=`<text x="${x+w/2}" y="${y-9}" text-anchor="middle" class="svg-value">${nf(total)}</text>
      <text x="${x+w/2}" y="250" text-anchor="middle" class="svg-label" data-filter="year:${r.year}" tabindex="0" role="button">${r.year}</text></g>`;
  });
  return out+"</svg>";
}
function sequenceTable(pairs) {
  return `<div class="sequence-table-wrap"><table class="sequence-table" aria-label="Trình tự mua, số khách hàng và thời gian trung vị">
    <thead><tr><th>Trình tự mua</th><th>Số khách hàng</th><th>Thời gian trung vị (ngày)</th></tr></thead>
    <tbody>${pairs.map(r=>`<tr data-tip="${esc(PRODUCT[r.first])} trước ${esc(PRODUCT[r.second])}: ${nf(r.count)} khách; thời gian trung vị ${nf(Math.round(r.medianDays))} ngày">
      <td><strong>${esc(PRODUCT[r.first])} → ${esc(PRODUCT[r.second])}</strong></td>
      <td><strong>${nf(r.count)}</strong></td>
      <td><strong>${nf(Math.round(r.medianDays))}</strong></td>
    </tr>`).join("")}</tbody></table></div><div class="sequence-foot">Thời gian trung vị được tính theo từng trình tự mua, không bao gồm trường hợp mua cùng ngày. Số liệu lũy kế đến cuối ${state.filters.year}; bảng không chịu tác động của bộ lọc phân khúc.</div>`;
}
function legendSVG(items,x,y) {
  return items.map(([color,label],i)=>`<rect x="${x+i*200}" y="${y-8}" width="9" height="9" rx="2" fill="${color}"/>
    <text x="${x+15+i*200}" y="${y}" class="svg-small">${label}</text>`).join("");
}
function roleBars(items) {
  const W=1200,H=235,left=155,length=975;
  let out=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Biểu đồ thanh chồng 100 phần trăm vai trò sản phẩm">
    ${legendSVG([[C.navy,"Trong lần mua đầu tiên"],[C.orange,"Mua bổ sung sau lần đầu"]],320,14)}`;
  items.forEach((r,i)=>{
    const y=34+i*39,total=r.first+r.additional,w1=total?length*r.first/total:0,w2=total?length-w1:0;
    out+=`<g data-tip="${esc(PRODUCT[r.code])}: ${nf(r.first)} lần đầu (${pct(r.first,total)}), ${nf(r.additional)} bổ sung (${pct(r.additional,total)})">
      <text x="8" y="${y+16}" class="svg-label">${r.code} · ${PRODUCT[r.code]}</text>
      <rect x="${left}" y="${y}" width="${w1}" height="26" rx="5" fill="${C.navy}" data-filter="role:${r.code}:first" tabindex="0" role="button"/>
      <rect x="${left+w1}" y="${y}" width="${w2}" height="26" rx="5" fill="${C.orange}" data-filter="role:${r.code}:additional" tabindex="0" role="button"/>
      ${w1>85?`<text x="${left+w1/2}" y="${y+17}" class="svg-value-white" text-anchor="middle">${nf(r.first)} · ${pct(r.first,total)}</text>`:""}
      ${w2>85?`<text x="${left+w1+w2/2}" y="${y+17}" font-size="11" fill="#543518" font-weight="800" text-anchor="middle">${nf(r.additional)} · ${pct(r.additional,total)}</text>`:""}
      ${w2<=85?`<text x="${left+w1-9}" y="${y+17}" text-anchor="end" font-size="11" fill="#fff" font-weight="800">${r.additional} bổ sung</text>`:""}
      <text x="1145" y="${y+17}" class="svg-small" font-weight="700">${nf(total)} KH</text>
    </g>`;
  });
  return out+"</svg>";
}
function revenueCombo(items) {
  const W=710,H=260,base=218,left=57,max=Math.max(1,Math.ceil(Math.max(...items.map(r=>r.single+r.multi))*1.15));
  let out=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Doanh số nhóm đơn sản phẩm và đa sản phẩm, kèm tỷ trọng theo năm">
    ${[0,1,2,3].map(i=>max*i/3).map(n=>`<line x1="${left}" x2="668" y1="${base-n/max*168}" y2="${base-n/max*168}" class="grid-line"/><text x="42" y="${base-n/max*168+4}" class="svg-tick" text-anchor="end">${nf(n,n<5?1:0)}</text>`).join("")}
    ${[0,25,50,75,100].map(n=>`<text x="685" y="${218-n/100*168+4}" class="svg-tick" text-anchor="middle">${n}%</text>`).join("")}
    <text x="6" y="15" class="svg-small">Tỷ đồng</text>
    ${legendSVG([[C.sky,"Đơn sản phẩm"],[C.navy,"Đa sản phẩm"]],95,13)}
    <line x1="495" y1="9" x2="517" y2="9" stroke="${C.orange}" stroke-width="3"/>
    <circle cx="506" cy="9" r="3.4" fill="${C.orange}"/>
    <text x="525" y="13" class="svg-small">Tỷ trọng đa SP</text>`;
  let path=[];
  items.forEach((r,i)=>{
    const x=111+i*193,w=77,b1=r.single/max*168,b2=r.multi/max*168,ratio=r.multi/Math.max(0.00001,r.single+r.multi);
    const xx=x+w/2, yy=210-ratio*150;
    path.push([xx,yy]);
    out+=`<g data-tip="${r.year}: đơn SP ${nf(r.single,2)} tỷ, đa SP ${nf(r.multi,2)} tỷ, tỷ trọng đa SP ${pct(r.multi,r.single+r.multi)}">
      <rect x="${x}" y="${base-b1}" width="${w}" height="${b1}" rx="3" fill="${C.sky}" data-filter="revenueClass:single:${r.year}" tabindex="0" role="button"/>
      <rect x="${x}" y="${base-b1-b2}" width="${w}" height="${b2}" rx="3" fill="${C.navy}" data-filter="revenueClass:multi:${r.year}" tabindex="0" role="button"/>
      <text x="${xx}" y="${base-b1/2+4}" text-anchor="middle" fill="#173f79" font-size="10.5" font-weight="800">${nf(r.single,2)}</text>
      <text x="${xx}" y="${base-b1-b2/2+4}" text-anchor="middle" fill="#fff" font-size="10.5" font-weight="800">${nf(r.multi,2)}</text>
      <text x="${xx}" y="244" text-anchor="middle" class="svg-label" data-filter="year:${r.year}" tabindex="0" role="button">${r.year}</text>
    </g>`;
  });
  out+=`<polyline points="${path.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${C.orange}" stroke-width="3" stroke-linejoin="round"/>`;
  path.forEach(([x,y],i)=>{
    const r=items[i],ratio=r.multi/Math.max(0.00001,r.multi+r.single);
    out+=`<circle cx="${x}" cy="${y}" r="5" fill="${C.orange}" stroke="#fff" stroke-width="2" data-tip="Tỷ trọng doanh số đa SP: ${pct(r.multi,r.multi+r.single)}"/>
      <text x="${x+12}" y="${base-(r.single+r.multi)/max*168-11}" font-size="11" font-weight="800" fill="#c57d39">${pct(r.multi,r.multi+r.single)}</text>`;
  });
  return out+"</svg>";
}
function waterfall(obj) {
  const totalAmount=Object.values(obj).reduce((a,b)=>a+b,0);
  const W=710,H=260,base=220,top=24,max=Math.max(50,Math.ceil(totalAmount*1.12/50)*50),left=58;
  const values="BCDE".split("").map(code=>({code,value:obj[code]}));
  const sum=values.reduce((acc,o)=>acc+o.value,0);
  let out=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Waterfall giá trị giao dịch mua bổ sung sau sản phẩm A">
    <text x="9" y="15" class="svg-small">Triệu đồng</text>
    ${[0,1,2,3].map(i=>max*i/4).map(n=>`<line x1="${left}" x2="694" y1="${base-n/max*(base-top)}" y2="${base-n/max*(base-top)}" class="grid-line"/><text x="48" y="${base-n/max*(base-top)+4}" class="svg-tick" text-anchor="end">${nf(n,n<20?1:0)}</text>`).join("")}`;
  let subtotal=0;
  values.forEach((r,i)=>{
    const x=82+i*125,w=72, yPrev=base-subtotal/max*(base-top);
    subtotal+=r.value;
    const yNow=base-subtotal/max*(base-top);
    const col=i===1?C.blue:(i===0?C.sky:"#9fbde5");
    out+=`<g data-filter="product:${r.code}" tabindex="0" role="button" data-tip="${r.code} · ${esc(PRODUCT[r.code])}: ${nf(r.value,2)} triệu đồng · Bấm để lọc khách sở hữu sản phẩm">
       <rect x="${x}" y="${yNow}" width="${w}" height="${yPrev-yNow}" rx="3" fill="${col}"/>
       <text x="${x+w/2}" y="${yNow-8}" text-anchor="middle" class="svg-value" font-size="11">+${nf(r.value,2)}</text>
       <text x="${x+w/2}" y="241" text-anchor="middle" class="svg-label">${r.code}</text>
       ${i<3?`<line x1="${x+w}" x2="${x+125}" y1="${yNow}" y2="${yNow}" stroke="#a3b5cc" stroke-dasharray="3 3"/>`:""}
      </g>`;
  });
  const ty=base-sum/max*(base-top);
  out+=`<g data-tip="Tổng trong phạm vi mua mới B–E sau A: ${nf(sum,2)} triệu đồng; không đại diện toàn bộ doanh số bán chéo">
    <rect x="584" y="${ty}" width="79" height="${base-ty}" rx="3" fill="${C.navy}"/>
    <text x="623" y="${ty-9}" text-anchor="middle" class="svg-value" font-size="12">${nf(sum,2)}</text>
    <text x="623" y="241" text-anchor="middle" class="svg-label">Tổng</text></g>`;
  return out+"</svg>";
}
function butterfly(data) {
  const W=710,H=252,mid=354,leftEnd=319,rightStart=390,scale=215/Math.max(1,data.base);
  let out=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="So sánh số khách đã mua và chưa mua sản phẩm bổ trợ trên tập khách A">
    ${legendSVG([[C.blue,"Đã mua"],[C.orangePale,"Chưa mua"]],203,16)}
    ${["B","C","D","E"].map((p,i)=>{
      const y=37+i*44,b=data.bought[p],m=data.missing[p],bW=b*scale,mW=m*scale;
      return `<g data-tip="${esc(PRODUCT[p])}: đã mua ${nf(b)} KH; chưa mua ${nf(m)} KH · ${pct(m,data.base)} trên ${nf(data.base)} KH có A">
        <rect x="${leftEnd-bW}" y="${y}" width="${bW}" height="25" rx="4" fill="${C.blue}" data-filter="status:${p}:owned" tabindex="0" role="button"/>
        <rect x="${rightStart}" y="${y}" width="${mW}" height="25" rx="4" fill="${C.orangePale}" data-filter="status:${p}:missing" tabindex="0" role="button"/>
        <text x="${leftEnd-bW-8}" y="${y+17}" text-anchor="end" class="svg-value">${b} (${pct(b,data.base)})</text>
        <text x="${rightStart+mW+8}" y="${y+17}" text-anchor="start" class="svg-value">${m} (${pct(m,data.base)})</text>
        <text x="${mid+1}" y="${y+17}" text-anchor="middle" class="svg-label" font-weight="800">${p}</text>
      </g>`;
    }).join("")}
    <text x="190" y="237" text-anchor="middle" class="svg-small">Đã mua sản phẩm bổ trợ</text>
    <text x="513" y="237" text-anchor="middle" class="svg-small">Chưa mua sản phẩm bổ trợ</text>
    <line x1="350" y1="30" x2="350" y2="215" stroke="#e9eef6"/>
    <line x1="359" y1="30" x2="359" y2="215" stroke="#e9eef6"/>
  </svg>`;
  return out;
}
function heatmap(stats) {
  const rows=stats.slice(), labels={all:"Quy mô × ngành",industry:"Theo ngành nghề",size:"Theo quy mô",city:"Theo địa bàn"};
  if(!rows.length)return '<div class="no-data">Không có khách đã mua A trong nhóm đang lọc</div>';
  let out=`<table class="heatmap" aria-label="Tỷ lệ khách hàng có A chưa mua B-E theo phân khúc">
    <thead><tr><th>${labels[state.segment]}</th>${"BCDE".split("").map(p=>`<th>${p} · ${PRODUCT[p]}</th>`).join("")}</tr></thead><tbody>`;
  rows.forEach(row=>{
    const shortLabel=row.label.replace("Doanh nghiệp siêu nhỏ","Siêu nhỏ").replace("Doanh nghiệp nhỏ","DN nhỏ")
      .replace("Thương mại - bán lẻ","Thương mại").replace("Dịch vụ - du lịch","Dịch vụ")
      .replace("Xây dựng - lắp đặt","Xây dựng").replace("Ngành nghề khác","Khác");
    out+=`<tr><td class="seg-label ${row.base<30?"small-sample":""}" role="button" tabindex="0" data-filter="segment:${row.dimension}:${esc(row.label)}" title="${row.base<30?"Cỡ mẫu dưới 30: chỉ diễn giải mô tả. ":""}Nhấp để lọc phân khúc">${esc(shortLabel)}<span class="seg-n">(n=${nf(row.base)}${row.base<30?" · ⚠":""})</span></td>`;
    "BCDE".split("").forEach(p=>{
      const n=row.missing[p],rate=n/Math.max(1,row.base),light=97-rate*48;
      const color=rate>.74?"#fff":"#174f81";
      out+=`<td style="background:hsl(213 64% ${light}%);color:${color}" role="button" tabindex="0" data-filter="heat:${row.dimension}:${esc(row.label)}:${p}" data-tip="${esc(row.label)}: ${nf(n)}/${nf(row.base)} KH có A chưa mua ${PRODUCT[p]} (${pct(n,row.base)}).${row.base<30?" Cỡ mẫu nhỏ: chỉ mô tả nhóm này.":""} Bấm để lọc nhóm này">
        ${pct(n,row.base)}<span class="cell-n">(${nf(n)})</span></td>`;
    });
    out+="</tr>";
  });
  out+=`</tbody></table><div class="heat-foot"><span>${state.segment==="all"?"Giao thoa quy mô × ngành: mỗi KH chỉ thuộc một hàng; ":""}Mẫu số: KH có A của từng hàng</span>
     <span class="heat-scale">Bấm ô để lọc sâu <i class="heat-gradient"></i> Tỷ lệ cao</span></div>`;
  return out;
}

function dashboard1() {
  const d=DATA.dashboard1,total=d.totalCustomers,multi=total-d.byProductCount["1"];
  const top12=d.combinations.slice(0,12).reduce((n,c)=>n+c.count,0),other=Math.max(0,multi-top12);
  const year=state.filters.year;
  const products="ABCDE".split("").map(code=>({code,n:d.perProduct[code]}));
  const singles="ABCDE".split("").map(code=>({code,n:d.singleProduct[code]}));
  const comboSelect=`<select class="select" id="combos" aria-label="Số tổ hợp hiển thị">
    <option value="12" ${state.combo==="12"?"selected":""}>Top 12 tổ hợp</option>
    <option value="all" ${state.combo==="all"?"selected":""}>Tất cả tổ hợp</option></select>`;
  return `<div class="kpis">
    ${kpi("Tổng khách hàng đã từng mua",nf(total),"KH",`Lũy kế đến cuối năm ${year}`,"featured")}
    ${kpi("Khách hàng đã mua A",nf(d.perProduct.A),"KH",PRODUCT.A)}
    ${kpi("Khách chỉ mua 1 sản phẩm",nf(d.byProductCount["1"]),"KH",pct(d.byProductCount["1"],total)+" tập khách hàng")}
    ${kpi("Khách hàng đa sản phẩm",nf(multi),"KH",pct(multi,total)+" tập khách hàng","orange")}
  </div>
  <div class="chart-grid">
    ${card("01 · Số khách hàng đã mua từng sản phẩm",`Số KH và tỷ trọng trên tổng ${nf(total)} khách hàng của bộ lọc`,hBars(products,total))}
    ${card("02 · Cơ cấu theo số sản phẩm đã mua","Tỷ trọng khách hàng theo số sản phẩm từng mua",donut([
      {label:"1 sản phẩm",n:d.byProductCount["1"],color:C.navy,filter:"1"},
      {label:"2 sản phẩm",n:d.byProductCount["2"],color:C.blue,filter:"2"},
      {label:"Từ 3 sản phẩm",n:d.byProductCount["3+"],color:C.orange,filter:"3+"},
    ],total,nf(total),"KHÁCH HÀNG","count"))}
    ${card("03 · Khách hàng chỉ mua một sản phẩm",`Số KH và tỷ trọng trong ${nf(d.byProductCount["1"])} khách chỉ mua 1 SP`,hBars(singles,d.byProductCount["1"],null,true))}
    ${card("04 – Cơ cấu tổ hợp mua từ hai sản phẩm",state.combo==="12"?`Top 12: ${nf(top12)}/${nf(multi)} KH đa SP (${pct(top12,multi)}); ${nf(other)} KH thuộc các tổ hợp khác`:`Tất cả tổ hợp chính xác (${nf(multi)} KH đa sản phẩm); chấm đậm = có mua`,upset(d.combinations),"chart-half",comboSelect)}
  </div>`;
}
function dashboard2() {
  const d=DATA.dashboard2,now=d.byYear.find(r=>r.year===state.filters.year);
  const ab=d.aBSequence,totalAb=ab["A→B"]+ab["B→A"]+ab["A+B"];
  const multi=now.initialOnly+now.initialThen+now.singleThen;
  const pairStats=SEQUENCE_SUMMARY.byYear[String(state.filters.year)]||[];
  return `<div class="kpis">
    ${kpi("Khách hàng đa sản phẩm",nf(multi),"KH",`Lũy kế đến cuối ${state.filters.year}`,"featured")}
    ${kpi("Mua kết hợp ngay lần đầu",nf(now.initial),"KH",`${nf(now.initialThen)} KH tiếp tục mua bổ sung`)}
    ${kpi("Có lịch sử mua bổ sung",nf(now.supplemental),"KH",`${nf(now.initialThen)} KH giao với nhóm kết hợp ban đầu`,"orange")}
    ${kpi("Mua AMIS Kế toán trước meInvoice",nf(ab["A→B"]),"KH","Mua A trước, sau đó mua B")}
  </div>
  <div class="chart-grid behavior">
    ${card("01 · Ba nhóm hành vi mua sản phẩm 2023–2025","Ba nhóm không trùng nhau: kết hợp ban đầu, kết hợp rồi mua thêm, hoặc mua thêm sau một SP đầu tiên",stackedYears(d.byYear),"chart-large")}
    ${card("02 · Trình tự mua giữa A và B",`Trong ${nf(totalAb)} khách đã mua cả A và B`,donut([
      {label:"A trước B",n:ab["A→B"],color:C.navy,filter:"A→B"},
      {label:"B trước A",n:ab["B→A"],color:C.orange,filter:"B→A"},
      {label:"A + B cùng ngày",n:ab["A+B"],color:C.sky,filter:"A+B"},
    ],totalAb,nf(totalAb),"KHÁCH HÀNG","ab"),"chart-large")}
    ${card("03 · Vai trò từng sản phẩm trong trình tự mua","Tỷ trọng và số KH mua sản phẩm ở lần đầu hoặc mua bổ sung sau lần đầu",roleBars(d.byProductRole),"chart-large chart-role")}
    ${card("04 · Trình tự và thời gian mua giữa các sản phẩm","Số khách hàng và thời gian trung vị theo từng chiều mua",sequenceTable(pairStats),"chart-large chart-sequence")}
  </div>`;
}
function geoTable(rows) {
  if(!rows.length)return '<div class="no-data">Không có khách hàng thuộc địa bàn đang lọc.</div>';
  return `<div class="geo-table-wrap"><table class="geo-table" aria-label="Địa bàn, cơ cấu khách hàng và doanh số">
    <thead><tr><th>Địa bàn</th><th>Tổng KH</th><th>KH đa SP</th><th>Doanh số 5 SP</th><th>KH có A</th><th>Có A, chưa B</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${esc(r.label)}</td><td>${nf(r.customers)}</td><td>${nf(r.multi)}<small>${pct(r.multi,r.customers)}</small></td>
      <td>${nf(r.revenue,3)} tỷ</td><td>${nf(r.baseA)}</td><td>${nf(r.missingB)}<small>${pct(r.missingB,r.baseA)}</small></td></tr>`).join("")}</tbody>
    </table></div><p class="geo-foot">Mỗi khách thuộc một địa bàn. Doanh số tính theo giao dịch trong năm lọc; sở hữu sản phẩm lũy kế đến cuối năm.</p>`;
}
function dashboard3() {
  const d=DATA.dashboard3,annual=d.revenue.find(r=>r.year===state.filters.year),totalRev=annual.single+annual.multi;
  const totalSupp=Object.values(d.supplementalMoney).reduce((a,b)=>a+b,0);
  const segmentSelect=`<select class="select" id="segment" aria-label="Phân nhóm heatmap">
    <option value="all" ${state.segment==="all"?"selected":""}>Quy mô × ngành</option>
    <option value="industry" ${state.segment==="industry"?"selected":""}>Ngành nghề</option>
    <option value="size" ${state.segment==="size"?"selected":""}>Quy mô DN</option>
    <option value="city" ${state.segment==="city"?"selected":""}>Địa bàn</option></select>`;
  const geoButton=`<button type="button" class="geography-button" data-detail="3-05" title="Bảng đối chiếu Đà Nẵng, Huế, Quảng Ngãi và Quảng Trị">▦ Bảng 4 địa bàn</button>`;
  return `<div class="kpis">
    ${kpi(`Doanh số 5 sản phẩm năm ${state.filters.year}`,nf(totalRev,2),"tỷ đồng","Giá trị giao dịch chưa VAT","featured")}
    ${kpi("Doanh số nhóm khách đa SP",nf(annual.multi,2),"tỷ đồng",pct(annual.multi,totalRev)+" doanh số 5 SP")}
    ${kpi(`Mua mới SP khác sau A năm ${state.filters.year}`,nf(totalSupp,2),"triệu đồng","Chỉ mua mới B–E sau lần mua A đầu tiên","orange")}
    ${kpi("Khách hàng chỉ mua A",nf(DATA.dashboard1.singleProduct.A),"KH",PRODUCT.A)}
  </div>
  <div class="chart-grid revenue">
    ${card("01 · Doanh số theo nhóm khách hàng 2023–2025","Cột: doanh số (tỷ đồng) · Đường: tỷ trọng nhóm đa SP",revenueCombo(d.revenue),"chart-butterfly")}
    ${card(`02 · Giá trị mua mới sản phẩm khác sau AMIS Kế toán`,"Chỉ giao dịch mua mới B–E sau A, không phải tổng doanh số bán chéo · triệu đồng",waterfall(d.supplementalMoney),"chart-butterfly")}
    ${card("03 · Khách đã mua A: đã mua và chưa mua B–E",`Mỗi cặp có mẫu số ${nf(d.aSubset.base)} khách đã mua A`,butterfly(d.aSubset),"chart-butterfly")}
    ${card("04 · Khoảng trống mua sản phẩm theo phân khúc",state.segment==="all"?"Giao thoa quy mô × ngành · tỷ lệ chưa sở hữu B–E trong nhóm có A":"Theo từng nhóm · tỷ lệ KH có A chưa sở hữu B–E",heatmap(state.segment==="all"?
      d.segments.sizeIndustry.map(r=>({...r,dimension:"sizeIndustry"})):
      d.segments[state.segment].map(r=>({...r,dimension:state.segment}))),"chart-heat",segmentSelect+geoButton)}
  </div>`;
}
function render() {
  if(!COHORTS)return;
  DATA=CrossFilterEngine.aggregate(COHORTS,state.filters);
  const [title,sub]=descriptions[state.view];
  document.getElementById("pageTitle").textContent=title;
  hideTooltip();
  document.getElementById("pageDescription").textContent=dynamicInsight();
  document.getElementById("pageNumber").textContent=String(state.view).padStart(2,"0");
  updateFilterControls();
  document.querySelectorAll(".tab").forEach(button=>{
    button.classList.toggle("active",Number(button.dataset.view)===state.view);
    button.setAttribute("aria-current",Number(button.dataset.view)===state.view?"page":"false");
  });
  document.getElementById("dashboard").innerHTML=state.view===1?dashboard1():state.view===2?dashboard2():dashboard3();
  fitStage();
}
function dynamicInsight() {
  const d1=DATA.dashboard1, d2=DATA.dashboard2, d3=DATA.dashboard3;
  const f=state.filters,year=f.year,total=d1.totalCustomers;
  const hasDetailFilters=activeEntries().some(([key])=>key!=="year");
  const caution=sampleCaution(total);
  if(!d1.totalCustomers)return "Không có khách hàng phù hợp. Hãy xóa bớt điều kiện lọc.";
  if(state.view===1) {
    const singles=d1.byProductCount["1"],multi=total-singles;
    if(!hasDetailFilters)return `Năm ${year}, có ${nf(multi)}/${nf(total)} khách hàng (${pct(multi,total)}) sở hữu từ hai sản phẩm; ${nf(singles)} khách (${pct(singles,total)}) chỉ sở hữu một sản phẩm.`;
    if(f.productStatus)return `Tệp đang xét gồm ${nf(total)} khách có A và ${f.productStatus.owned?"đã":"chưa"} sở hữu ${PRODUCT[f.productStatus.code]}; ${nf(singles)} khách chỉ có một SP, ${nf(multi)} khách có nhiều SP.${caution}`;
    if(f.ab)return `Tệp trình tự ${f.ab} gồm ${nf(total)} khách; ${nf(d1.byProductCount["3+"])} khách đã sở hữu từ ba sản phẩm, hữu ích để xem khả năng mở rộng danh mục.${caution}`;
    if(!singles)return `Tệp đã lọc có ${nf(total)} khách đa sản phẩm; ${nf(d1.byProductCount["3+"])} khách sở hữu từ ba SP. Xem các tổ hợp chính xác để nhận diện cấu hình mua.${caution}`;
    if(!multi){
      const top=d3.segments.industry[0],baseA=d3.aSubset.base;
      return top&&baseA===total?`Tệp có ${nf(total)} khách chỉ sở hữu một sản phẩm; ngành ${top.label} chiếm nhiều nhất (${nf(top.base)} KH, ${pct(top.base,total)}), gợi ý hướng phân nhóm để đánh giá bán chéo.${caution}`:`Tệp đã lọc gồm ${nf(total)} khách sở hữu đúng một sản phẩm; tiếp tục phân nhóm theo ngành và địa bàn.${caution}`;
    }
    return `Trong ${nf(total)} khách của tệp lọc, ${nf(multi)} khách sở hữu nhiều SP (${pct(multi,total)}); ${nf(d1.singleProduct.A)} khách chỉ sở hữu A, cần phân nhóm thêm để nghiên cứu bán chéo.${caution}`;
  }
  if(state.view===2) {
    const row=d2.byYear.find(r=>r.year===year),multi=row.initialOnly+row.initialThen+row.singleThen;
    if(!multi)return `Tệp đang xét không ghi nhận khách đa sản phẩm đến cuối ${year}; không có trình tự mua bổ sung để phân tích.${caution}`;
    if(!hasDetailFilters)return `Trong ${nf(multi)} khách đa sản phẩm năm ${year}, ${nf(row.initial)} khách mua kết hợp ngay lần đầu; ${nf(row.supplemental)} khách mua bổ sung về sau. Có ${nf(row.initialThen)} khách thuộc cả hai nhóm; ba nhóm không trùng nhau là ${nf(row.initialOnly)} – ${nf(row.initialThen)} – ${nf(row.singleThen)}.`;
    if(f.ab)return `Đã chọn trình tự ${f.ab}: ${nf(total)} khách; ${nf(d1.byProductCount["3+"])} khách sở hữu từ ba SP. Đối chiếu thêm ngành và quy mô để xác định nhóm ưu tiên.${caution}`;
    if(f.purchaseType)return `Đã chọn ${nf(total)} KH thuộc nhóm ${purchaseTypeLabel(f.purchaseType).toLowerCase()}; có ${nf(d1.byProductCount["3+"])} khách đã mua từ ba sản phẩm.${caution}`;
    return `Trong ${nf(multi)} khách đa sản phẩm thuộc tệp lọc: ${nf(row.initialOnly)} mua kết hợp ban đầu không mua thêm, ${nf(row.initialThen)} mua kết hợp rồi mua thêm, ${nf(row.singleThen)} mua một SP đầu tiên rồi bổ sung sản phẩm khác.${caution}`;
  }
  const rev=d3.revenue.find(r=>r.year===year),sum=rev.single+rev.multi,a=d3.aSubset.base,missing=d3.aSubset.missing.B;
  if(!sum)return `Tệp khách đã chọn không ghi nhận doanh số của 5 sản phẩm trong năm ${year}.${caution}`;
  if(!a)return `Tệp đã lọc có doanh số ${nf(sum,2)} tỷ đồng năm ${year}; không có khách sở hữu A để phân tích khoảng trống B–E.${caution}`;
  if(!hasDetailFilters)return `Khách đa sản phẩm đóng góp ${pct(rev.multi,sum)} doanh số năm ${year}; đồng thời, ${nf(missing)}/${nf(a)} khách sử dụng AMIS Kế toán chưa sở hữu meInvoice — tệp sàng lọc cơ hội bán chéo.`;
  if(f.productStatus)return `Tệp đang xét có ${nf(total)} khách có A và ${f.productStatus.owned?"đã":"chưa"} sở hữu ${PRODUCT[f.productStatus.code]}; doanh số giao dịch năm ${year} đạt ${nf(sum,2)} tỷ đồng. Phân tích tiếp quy mô × ngành.${caution}`;
  if(f.revenueClass||rev.multi===sum||rev.multi===0)return `Tệp đã lọc đóng góp ${nf(sum,2)} tỷ đồng doanh số năm ${year}; ${nf(missing)}/${nf(a)} khách có A chưa sở hữu meInvoice. Ưu tiên đối chiếu theo phân khúc.${caution}`;
  return `Nhóm đa sản phẩm tạo ${nf(rev.multi,2)} tỷ đồng (${pct(rev.multi,sum)}) trên tệp lọc; ${nf(missing)}/${nf(a)} khách có A chưa sở hữu B — khoảng trống cần phân nhóm.${caution}`;
}
function sampleCaution(n) {
  return n<30?` Cỡ mẫu nhỏ (n=${nf(n)}): kết quả chỉ mô tả nhóm đang lọc, không suy rộng.`:"";
}
function purchaseTypeLabel(value) {
  return ({initialOnly:"Kết hợp đầu, không mua thêm",initialThen:"Kết hợp đầu, sau đó mua thêm",
    singleThen:"Một SP đầu, sau đó mua thêm",initial:"Kết hợp ban đầu",supplemental:"Có mua bổ sung"})[value]||value;
}
function activeEntries() {
  const f=state.filters;
  return [
    f.year!==2025&&["year",`Năm ${f.year}`],
    f.size&&["size",f.size.replace("Doanh nghiệp ","DN ")],
    f.industry&&["industry",f.industry],
    f.city&&["city",f.city],
    f.product&&["product",`${f.product} · ${PRODUCT[f.product]}`],
    f.count&&["count",`Số SP: ${f.count}`],
    f.combo&&["combo",`Tổ hợp ${f.combo}`],
    f.ab&&["ab",`Trình tự ${f.ab}`],
    f.role&&["role",`${f.role.code}: ${f.role.mode==="first"?"Mua đầu":"Mua sau"}`],
    f.purchaseType&&["purchaseType",purchaseTypeLabel(f.purchaseType)],
    f.revenueClass&&["revenueClass",f.revenueClass==="multi"?"Doanh số KH đa SP":"Doanh số KH đơn SP"],
    f.productStatus&&["productStatus",`${f.productStatus.owned?"Đã mua":"Chưa mua"} ${f.productStatus.code} trong tệp A`]
  ].filter(Boolean);
}
function updateFilterControls() {
  const f=state.filters;
  for(const [id,key] of [["filterYear","year"],["filterSize","size"],["filterIndustry","industry"],["filterCity","city"],
    ["filterProduct","product"],["filterCount","count"]]){
    const field=document.getElementById(id);
    if(field)field.value=f[key]||"";
  }
  const entries=activeEntries();
  document.getElementById("activeFilterChips").innerHTML=entries.length?
    entries.map(([key,label])=>`<button class="filter-chip" data-clear="${key}" title="Bỏ điều kiện này">${esc(label)} ×</button>`).join(""):
    `<span class="filter-idle">Bấm biểu đồ để lọc chéo</span>`;
  document.getElementById("drillUp").disabled=state.segment==="all";
  document.getElementById("drillDown").disabled=state.segment==="city";
  document.getElementById("drillDown").title=`Drill down theo ${state.segment==="all"?"quy mô":state.segment==="size"?"ngành nghề":"địa bàn"}`;
  const dateChip=document.querySelector(".date-chip");
  dateChip.innerHTML=`<span class="dot"></span> Tệp KH đến 31/12/${f.year}`;
  document.getElementById("yearLogic").textContent=`ⓘ Tệp đến ${f.year}`;
  document.getElementById("yearInfoSelected").textContent=`Năm ${f.year} xác định tệp khách hàng có lịch sử mua và tình trạng sở hữu đến ngày 31/12/${f.year}.`;
  document.getElementById("filterCountSummary").textContent=`${nf(DATA.dashboard1.totalCustomers)} khách hàng · năm ${f.year}`;
}
function resetFilters() {
  Object.assign(state.filters,{year:2025,size:"",industry:"",city:"",product:"",count:"",combo:"",
    ab:"",role:null,purchaseType:"",revenueClass:"",aSubset:false,productStatus:null});
  state.segment="all";
  render();
}
function toggleValue(key,value) {
  state.filters[key]=state.filters[key]===value?"":value;
}
function moveDrill(direction) {
  const levels=["all","size","industry","city"];
  const from=levels.indexOf(state.segment),to=Math.max(0,Math.min(levels.length-1,from+direction));
  if(direction<0) {
    const removed=levels[from];
    if(removed!=="all")state.filters[removed]="";
  }
  state.segment=levels[to];
  render();
}
function selectSegment(dimension,value) {
  if(dimension==="sizeIndustry"){
    const [size,industry]=value.split(" × ");
    const same=state.filters.size===size && state.filters.industry===industry;
    state.filters.size=same?"":size;
    state.filters.industry=same?"":industry;
    state.segment=same?"all":"city";
    return;
  }
  toggleValue(dimension,value);
  if(state.filters[dimension]) {
    const next={size:"industry",industry:"city",city:"city"};
    state.segment=next[dimension]||"all";
  }
}
function handleChartFilter(raw) {
  const parts=raw.split(":"),kind=parts[0],p=parts[1],q=parts[2],r=parts[3];
  if(kind==="year")state.filters.year=Number(p);
  else if(kind==="single"){
    if(state.filters.product===p&&state.filters.count==="1"){
      state.filters.product="";state.filters.count="";
    }else{
      state.filters.product=p;state.filters.count="1";
    }
  }
  else if(kind==="product" || kind==="combo" || kind==="count" || kind==="ab")toggleValue(kind,p);
  else if(kind==="purchaseType") {
    state.filters.year=Number(q);
    toggleValue("purchaseType",p);
  }
  else if(kind==="revenueClass") {
    state.filters.year=Number(q);
    toggleValue("revenueClass",p);
  }
  else if(kind==="role") {
    const was=state.filters.role;
    state.filters.role=was&&was.code===p&&was.mode===q?null:{code:p,mode:q};
  }
  else if(kind==="status") {
    const wanted={code:p,owned:q==="owned"},was=state.filters.productStatus;
    state.filters.productStatus=was&&was.code===p&&was.owned===wanted.owned?null:wanted;
    state.filters.aSubset=!!state.filters.productStatus;
  }
  else if(kind==="segment" && (p==="size"||p==="industry"||p==="city"||p==="sizeIndustry"))selectSegment(p,parts.slice(2).join(":"));
  else if(kind==="heat" && (p==="size"||p==="industry"||p==="city"||p==="sizeIndustry")) {
    selectSegment(p,q);
    state.filters.productStatus={code:r,owned:false};
    state.filters.aSubset=true;
  }
  render();
}
const analysisDialog=document.getElementById("analysisDialog");
const displayProduct=code=>`${code} · ${PRODUCT[code]}`;
const analysisRow=(name,value,detail="")=>({name,value,detail});
function analysisDetails(id) {
  const d1=DATA.dashboard1,d2=DATA.dashboard2,d3=DATA.dashboard3;
  const year=state.filters.year;
  const total=d1.totalCustomers, singles=d1.byProductCount["1"],multi=total-singles;
  const yearBehavior=d2.byYear.find(r=>r.year===year);
  const yearRevenue=d3.revenue.find(r=>r.year===year);
  const revTotal=yearRevenue.single+yearRevenue.multi;
  const ab=d2.aBSequence,abTotal=ab["A→B"]+ab["B→A"]+ab["A+B"];
  const a=d3.aSubset.base;
  const result={lead:"",takeaway:"",definition:"",rows:[]};
  switch(id) {
    case "overview": {
      Object.assign(result,{
        lead:`Trong ${nf(total)} khách hàng đang được phân tích, ${nf(multi)} khách sở hữu từ hai sản phẩm; nhóm này đóng góp ${pct(yearRevenue.multi,revTotal)} doanh số năm ${year}.`,
        takeaway:`Ba góc nhìn liên kết theo cùng bộ lọc: (1) phạm vi sở hữu sản phẩm, (2) thời điểm bổ sung sản phẩm, (3) giá trị giao dịch và nhóm chưa sở hữu sản phẩm bổ trợ. Đây là cơ sở để xác định ưu tiên bán chéo, chưa phải bằng chứng về nhu cầu mua.`,
        definition:`Tệp khách hàng và số sản phẩm là số lũy kế đến cuối ${year}. Doanh số được tính theo giao dịch của 5 sản phẩm trong năm ${year}, chưa VAT.`,
        rows:[analysisRow("Khách chỉ mua một sản phẩm",nf(singles),pct(singles,total)+" trên tệp được lọc"),
          analysisRow("Khách mua từ hai sản phẩm",nf(multi),pct(multi,total)+" trên tệp được lọc"),
          analysisRow("Có lịch sử mua bổ sung",nf(yearBehavior.supplemental),pct(yearBehavior.supplemental,multi)+" nhóm đa SP"),
          analysisRow("Doanh số KH đa sản phẩm",nf(yearRevenue.multi,2)+" tỷ",pct(yearRevenue.multi,revTotal)+" doanh số 5 SP"),
          analysisRow("Chỉ mua AMIS Kế toán",nf(d1.singleProduct.A),"Chưa sở hữu B–E")]
      });break;
    }
    case "1-01": {
      const top=Object.entries(d1.perProduct).sort((x,y)=>y[1]-x[1])[0];
      Object.assign(result,{
        lead:`${displayProduct(top[0])} có số khách sở hữu lớn nhất (${nf(top[1])} KH, ${pct(top[1],total)} tập phân tích).`,
        takeaway:`Đối chiếu quy mô sở hữu giữa A–E giúp xác định sản phẩm nền và sản phẩm có độ phủ thấp. Độ phủ thấp chỉ là dấu hiệu cần tìm hiểu khả năng bán chéo, không đồng nghĩa với nhu cầu đã được xác nhận.`,
        definition:`“Đã mua” đếm mỗi khách một lần cho từng sản phẩm; cùng một khách có thể xuất hiện ở nhiều thanh. Mẫu số tỷ trọng là ${nf(total)} khách đang lọc.`,
        rows:"ABCDE".split("").map(p=>analysisRow(displayProduct(p),nf(d1.perProduct[p])+" KH",pct(d1.perProduct[p],total)+" tệp khách hàng"))
      });break;
    }
    case "1-02": {
      Object.assign(result,{
        lead:`${nf(singles)} khách chỉ sở hữu một sản phẩm (${pct(singles,total)}); ${nf(multi)} khách đã mua kết hợp từ hai sản phẩm trở lên.`,
        takeaway:`Nhóm một sản phẩm có thể là đối tượng tìm hiểu mức độ phù hợp của các sản phẩm bổ trợ; nhóm đa sản phẩm cung cấp bằng chứng về các tổ hợp đã được lựa chọn thực tế.`,
        definition:`Mỗi khách thuộc đúng một nhóm theo số sản phẩm khác nhau đã mua lũy kế đến 31/12/${year}. Mẫu số: ${nf(total)} khách.`,
        rows:[["1 sản phẩm",d1.byProductCount["1"]],["2 sản phẩm",d1.byProductCount["2"]],["Từ 3 sản phẩm",d1.byProductCount["3+"]]].map(([k,n])=>analysisRow(k,nf(n)+" KH",pct(n,total)))
      });break;
    }
    case "1-03": {
      Object.assign(result,{
        lead:`Trong ${nf(singles)} khách chỉ mua một sản phẩm, có ${nf(d1.singleProduct.A)} khách chỉ sở hữu AMIS Kế toán (${pct(d1.singleProduct.A,singles)}).`,
        takeaway:`Khách chỉ có A là nhóm có thể rà soát thêm mức phù hợp của hóa đơn điện tử, chữ ký số, dịch vụ thuế và tài chính. Cần phân tích nhu cầu, ngành và quy mô trước khi xây dựng gói bán chéo.`,
        definition:`“Chỉ mua A” nghĩa là đã mua A và chưa ghi nhận mua B, C, D, E trong phạm vi dữ liệu đến cuối ${year}. Mẫu số: ${nf(singles)} khách chỉ mua 1 SP.`,
        rows:"ABCDE".split("").map(p=>analysisRow(displayProduct(p),nf(d1.singleProduct[p])+" KH",pct(d1.singleProduct[p],singles)+" nhóm đơn SP"))
      });break;
    }
    case "1-04": {
      const first=d1.combinations[0],combos=d1.combinations.slice(0,12);
      const covered=combos.reduce((n,c)=>n+c.count,0),remainder=Math.max(0,multi-covered);
      Object.assign(result,{
        lead:first?`Tổ hợp ${first.code.split("").join(" + ")} phổ biến nhất, với ${nf(first.count)} khách (${pct(first.count,multi)} nhóm đa sản phẩm).`:`Bộ lọc hiện tại chưa ghi nhận khách mua nhiều sản phẩm.`,
        takeaway:`Tần suất các tổ hợp cho thấy sản phẩm nào thường được lựa chọn cùng nhau. Có thể dùng kết quả để xây dựng và kiểm định gói sản phẩm, nhưng tổ hợp mua không tự chỉ ra nguyên nhân lựa chọn.`,
        definition:`Tổ hợp chính xác: AB không bao gồm ABC. Top 12 bao phủ ${nf(covered)}/${nf(multi)} KH đa sản phẩm (${pct(covered,multi)}); còn ${nf(remainder)} KH ở các tổ hợp khác.`,
        rows:combos.map(c=>analysisRow(c.code.split("").map(p=>PRODUCT[p]).join(" + "),nf(c.count)+" KH",pct(c.count,multi)+" nhóm đa SP"))
      });break;
    }
    case "2-01": {
      const mult=yearBehavior.initialOnly+yearBehavior.initialThen+yearBehavior.singleThen;
      Object.assign(result,{
        lead:`Đến cuối ${year}, ${nf(mult)} khách đa sản phẩm gồm ba nhóm không trùng nhau: ${nf(yearBehavior.initialOnly)} chỉ mua kết hợp ban đầu, ${nf(yearBehavior.initialThen)} kết hợp ban đầu rồi mua thêm và ${nf(yearBehavior.singleThen)} từ một sản phẩm đầu tiên mua thêm.`,
        takeaway:`Số khách mua kết hợp ngay lần đầu là ${nf(yearBehavior.initial)} = ${nf(yearBehavior.initialOnly)} + ${nf(yearBehavior.initialThen)}; số khách có mua bổ sung là ${nf(yearBehavior.supplemental)} = ${nf(yearBehavior.initialThen)} + ${nf(yearBehavior.singleThen)}. Hai chỉ tiêu có ${nf(yearBehavior.initialThen)} khách giao nhau nên không được cộng để tính tổng khách đa sản phẩm.`,
        definition:`Nhóm 1: mua ít nhất hai sản phẩm ngay lần giao dịch đầu, không mua thêm loại sản phẩm khác sau đó. Nhóm 2: mua từ hai sản phẩm lần đầu và mua thêm loại khác sau. Nhóm 3: mua một sản phẩm đầu, rồi mua thêm loại khác. Xét lũy kế đến 31/12 từng năm.`,
        rows:d2.byYear.flatMap(r=>[
          analysisRow(`${r.year} · Kết hợp đầu, không mua thêm`,nf(r.initialOnly)+" KH",pct(r.initialOnly,r.initialOnly+r.initialThen+r.singleThen)+" nhóm đa SP"),
          analysisRow(`${r.year} · Kết hợp đầu, có mua thêm`,nf(r.initialThen)+" KH",pct(r.initialThen,r.initialOnly+r.initialThen+r.singleThen)+" nhóm đa SP"),
          analysisRow(`${r.year} · Một SP đầu, sau đó mua thêm`,nf(r.singleThen)+" KH",pct(r.singleThen,r.initialOnly+r.initialThen+r.singleThen)+" nhóm đa SP")
        ])
      });break;
    }
    case "2-02": {
      Object.assign(result,{
        lead:`Trong ${nf(abTotal)} khách dùng cả A và B, ${nf(ab["A→B"])} khách mua A trước B (${pct(ab["A→B"],abTotal)}).`,
        takeaway:`Đường mua A → B cung cấp bằng chứng hành vi để thiết kế thời điểm giới thiệu meInvoice sau AMIS Kế toán. Nhóm mua cùng ngày phù hợp để nghiên cứu gói kết hợp ban đầu.`,
        definition:`Chỉ tính khách đã mua cả A và B (${nf(abTotal)} KH); phân loại bằng thứ tự giao dịch đầu của hai sản phẩm. Đây là trình tự sở hữu, không phải tỷ lệ chuyển đổi tiếp thị.`,
        rows:[["A trước B",ab["A→B"]],["B trước A",ab["B→A"]],["A và B cùng ngày",ab["A+B"]]].map(([k,n])=>analysisRow(k,nf(n)+" KH",pct(n,abTotal)))
      });break;
    }
    case "2-03": {
      const products=d2.byProductRole;
      const most=products.slice().sort((x,y)=>(y.additional/(y.first+y.additional||1))-(x.additional/(x.first+x.additional||1)))[0];
      Object.assign(result,{
        lead:`${displayProduct(most.code)} có tỷ trọng mua bổ sung cao nhất trong khách sở hữu sản phẩm (${pct(most.additional,most.first+most.additional)}).`,
        takeaway:`Những sản phẩm thường được mua sau giao dịch đầu là ứng viên để xây dựng lộ trình mở rộng giải pháp; sản phẩm mua ngay từ đầu có thể được bố trí trong gói cơ bản.`,
        definition:`Mẫu số mỗi sản phẩm là số khách đã mua chính sản phẩm đó, không phải tổng ${nf(total)} KH. Phân loại theo giao dịch đầu tiên của khách trong tệp phân tích.`,
        rows:products.map(r=>analysisRow(displayProduct(r.code),nf(r.additional)+" KH bổ sung",`${nf(r.first)} KH mua ban đầu · ${pct(r.additional,r.first+r.additional)} bổ sung`))
      });break;
    }
    case "2-04": {
      const pairs=SEQUENCE_SUMMARY.byYear[String(state.filters.year)]||[];
      const top=pairs.slice().sort((a,b)=>b.count-a.count)[0];
      Object.assign(result,{
        lead:top?`Trình tự ${PRODUCT[top.first]} → ${PRODUCT[top.second]} có ${nf(top.count)} khách hàng; thời gian trung vị giữa hai lần mua là ${nf(Math.round(top.medianDays))} ngày.`:"Không có trình tự mua bổ sung trong tệp đang xét.",
        takeaway:"Bảng thể hiện riêng từng chiều mua, không gộp hai chiều của cùng một cặp sản phẩm. Một khách hàng có thể xuất hiện trong nhiều trình tự khi sở hữu từ ba sản phẩm trở lên.",
        definition:`Thời gian trung vị được tính từ ngày mua mới đầu tiên của sản phẩm trước đến ngày mua mới đầu tiên của sản phẩm sau; không lấy ngày gia hạn và không bao gồm trường hợp mua cùng ngày. Trung vị được làm tròn đến ngày nguyên khi hiển thị. Số liệu lũy kế đến cuối ${year}, độc lập với các bộ lọc phân khúc.`,
        rows:pairs.map(r=>analysisRow(`${PRODUCT[r.first]} → ${PRODUCT[r.second]}`,
          nf(r.count)+" KH",`Thời gian trung vị: ${nf(Math.round(r.medianDays))} ngày`))
      });break;
    }
    case "3-01": {
      const old=d3.revenue[0],oldShare=old.multi/(old.single+old.multi||1),newShare=yearRevenue.multi/(revTotal||1);
      Object.assign(result,{
        lead:`Năm ${year}, khách đa sản phẩm đóng góp ${nf(yearRevenue.multi,2)} tỷ đồng (${pct(yearRevenue.multi,revTotal)}) trên ${nf(revTotal,2)} tỷ doanh số 5 sản phẩm.`,
        takeaway:`Tỷ trọng doanh số nhóm đa sản phẩm ${newShare>oldShare?"cao hơn":newShare<oldShare?"thấp hơn":"bằng"} năm 2023 ${nf(Math.abs((newShare-oldShare)*100),1)} điểm phần trăm. Doanh số nhóm này là căn cứ định lượng vai trò mua kết hợp, không khẳng định nguyên nhân tăng doanh số.`,
        definition:`Chia doanh số 5 sản phẩm từng năm theo tình trạng sở hữu 1 hay từ 2 SP tại cuối năm đó; giá trị giao dịch chưa VAT, không đồng nhất với doanh thu kế toán.`,
        rows:d3.revenue.map(r=>analysisRow(String(r.year),nf(r.single+r.multi,2)+" tỷ",`${nf(r.multi,2)} tỷ từ KH đa SP · ${pct(r.multi,r.single+r.multi)} tổng doanh số`))
      });break;
    }
    case "3-02": {
      const supp=d3.supplementalMoney,totalSupp=Object.values(supp).reduce((s,n)=>s+n,0);
      const ranked=Object.entries(supp).sort((x,y)=>y[1]-x[1]);
      Object.assign(result,{
        lead:`Giá trị mua mới các sản phẩm khác sau AMIS Kế toán đạt ${nf(totalSupp,2)} triệu đồng năm ${year}; ${PRODUCT[ranked[0][0]]} chiếm ${pct(ranked[0][1],totalSupp)} chỉ tiêu này.`,
        takeaway:`Đây là doanh số giao dịch mua mới sản phẩm B–E phát sinh sau khi khách đã mua A, không phải tổng doanh số bán chéo, cũng không phải tổng doanh thu kế toán. Cần đối chiếu thêm số khách và các trình tự mua khác ngoài A trước.`,
        definition:`Chỉ cộng giao dịch loại “Mua mới” của sản phẩm B–E có ngày mua sau ngày mua A đầu tiên, phát sinh trong năm ${year}; đơn vị triệu đồng, chưa VAT. Không bao gồm mọi hình thức kết hợp hoặc bán chéo trong danh mục.`,
        rows:ranked.map(([p,n])=>analysisRow(displayProduct(p),nf(n,2)+" triệu",pct(n,totalSupp)+" tổng giá trị mua sau A"))
      });break;
    }
    case "3-03": {
      const gap=Object.entries(d3.aSubset.missing).sort((x,y)=>y[1]-x[1])[0];
      Object.assign(result,{
        lead:`Trong ${nf(a)} khách đã mua AMIS Kế toán, ${nf(gap[1])} khách chưa mua ${PRODUCT[gap[0]]} (${pct(gap[1],a)}) — khoảng trống sở hữu lớn nhất.`,
        takeaway:`Ưu tiên khảo sát nhu cầu thực tế trong nhóm có A nhưng chưa sở hữu B–E; đây chỉ là chỉ báo về phạm vi sở hữu, không phải danh sách khách có nhu cầu chắc chắn.`,
        definition:`Mỗi sản phẩm B–E được đối chiếu riêng trong ${nf(a)} khách đã sở hữu A; “đã mua” + “chưa mua” của từng sản phẩm bằng mẫu số này.`,
        rows:"BCDE".split("").map(p=>analysisRow(displayProduct(p),nf(d3.aSubset.missing[p])+" KH chưa mua",`${nf(d3.aSubset.bought[p])} KH đã mua · ${pct(d3.aSubset.missing[p],a)} chưa mua`))
      });break;
    }
    case "3-04": {
      const segments=state.segment==="all"?d3.segments.sizeIndustry:d3.segments[state.segment];
      const eligible=segments.filter(r=>r.base>=30);
      const best=eligible.slice().sort((x,y)=>(y.missing.B/y.base||0)-(x.missing.B/x.base||0)||y.base-x.base)[0];
      Object.assign(result,{
        lead:best?`Trong các phân khúc có ít nhất 30 KH sở hữu A, nhóm ${best.label} có ${nf(best.missing.B)}/${nf(best.base)} khách chưa sở hữu meInvoice (${pct(best.missing.B,best.base)}).`:`Không có phân khúc nào đạt 30 KH có A trong tệp đang lọc; các tỷ lệ chỉ có ý nghĩa mô tả.`,
        takeaway:`Phân khúc kết hợp quy mô × ngành giúp xác định tệp sàng lọc không trùng khách giữa các hàng. Khoảng trống sở hữu B–E chưa đồng nghĩa nhu cầu mua; cần đánh giá mức phù hợp và khả năng chuyển đổi.`,
        definition:`${state.segment==="all"?"Mỗi hàng là giao thoa quy mô × ngành; mỗi KH thuộc đúng một hàng. ":"Mỗi hàng là một nhóm phân loại riêng. "}Mẫu số từng hàng là số KH đã mua A trong nhóm; tỷ lệ = số KH chưa mua sản phẩm / mẫu số hàng. Hàng n<30 được cảnh báo.`,
        rows:segments.slice().sort((x,y)=>y.base-x.base).slice(0,10).map(r=>analysisRow(r.label,nf(r.base)+" KH có A",`${pct(r.missing.B,r.base)} chưa có B · ${pct(r.missing.C,r.base)} chưa có C${r.base<30?" · Cỡ mẫu nhỏ":""}`))
      });break;
    }
    case "3-05": {
      const geo=d3.geography,most=geo.slice().sort((a,b)=>b.customers-a.customers)[0];
      Object.assign(result,{
        lead:most?`${most.label} có ${nf(most.customers)} khách trong tệp đang lọc, gồm ${nf(most.multi)} khách đa sản phẩm (${pct(most.multi,most.customers)}); doanh số 5 sản phẩm trong năm ${year} đạt ${nf(most.revenue,3)} tỷ đồng.`:"Không có khách hàng trong tệp địa bàn đang lọc.",
        takeaway:"So sánh quy mô khách hàng, tỷ trọng mua nhiều sản phẩm, doanh số giao dịch và khoảng trống sở hữu A–B theo từng địa bàn giúp lựa chọn thị trường cần phân tích sâu hơn. Số chưa mua B chưa phản ánh nhu cầu hay khả năng chuyển đổi.",
        definition:`Tổng khách và số sản phẩm đã mua: lũy kế đến 31/12/${year}; doanh số: giá trị giao dịch 5 sản phẩm phát sinh trong năm ${year}, chưa VAT. Mỗi khách thuộc đúng một địa bàn. Mẫu số tỷ lệ chưa có B là khách đã mua A trong địa bàn.`,
        rows:geo.map(r=>analysisRow(r.label,`${nf(r.customers)} KH · ${nf(r.revenue,3)} tỷ`,
          `${nf(r.multi)} đa SP (${pct(r.multi,r.customers)}) · ${nf(r.missingB)}/${nf(r.baseA)} có A chưa B (${pct(r.missingB,r.baseA)})`))
      });break;
    }
  }
  if(total<30)result.takeaway+=sampleCaution(total);
  return result;
}
function openAnalysis(id,trigger) {
  hideTooltip();
  const details=analysisDetails(id);
  let heading,context,preview;
  if(id==="overview"){
    heading="Phân tích tổng hợp cơ hội bán chéo";
    context=`Tổng hợp ba dashboard · Tệp khách hàng đến 31/12/${state.filters.year}`;
    const r=DATA.dashboard1,beh=DATA.dashboard2.byYear.find(x=>x.year===state.filters.year),rev=DATA.dashboard3.revenue.find(x=>x.year===state.filters.year);
    preview=`<div class="overview-steps"><div><span>01 · SỞ HỮU</span><strong>${nf(r.totalCustomers-r.byProductCount["1"])} KH</strong><p>Đã mua từ 2 sản phẩm</p></div><div><span>02 · HÀNH VI</span><strong>${nf(beh.supplemental)} KH</strong><p>Có lịch sử mua bổ sung</p></div><div><span>03 · DOANH SỐ</span><strong>${pct(rev.multi,rev.single+rev.multi)}</strong><p>Doanh số từ nhóm đa SP</p></div></div>`;
  }else{
    const source=trigger.closest(".card");
    heading=source.querySelector(".card-title").textContent;
    context=source.querySelector(".card-sub").textContent;
    preview=source.querySelector(".card-body").innerHTML;
    if(id==="3-05"){
      heading="05 · Phân tích theo địa bàn";
      context=`Đà Nẵng · Huế · Quảng Ngãi · Quảng Trị · năm ${state.filters.year}`;
      preview=geoTable(DATA.dashboard3.geography);
    }
  }
  document.getElementById("analysisEyebrow").textContent=id==="overview"?"BỨC TRANH CHUNG · 3 DASHBOARD":`DASHBOARD ${state.view} · PHÂN TÍCH CHI TIẾT`;
  document.getElementById("analysisTitle").textContent=heading;
  document.getElementById("analysisContext").textContent=context;
  document.getElementById("analysisLead").textContent=details.lead;
  document.getElementById("analysisTakeaway").textContent=details.takeaway;
  document.getElementById("analysisDefinition").textContent=details.definition;
  document.getElementById("analysisPreview").innerHTML=preview;
  document.getElementById("analysisPreview").classList.toggle("overview-preview",id==="overview");
  document.getElementById("analysisRows").innerHTML=`<table class="analysis-table"><thead><tr><th>Nhóm / chỉ tiêu</th><th>Giá trị</th><th>Đối chiếu</th></tr></thead><tbody>${details.rows.map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(row.value)}</td><td>${esc(row.detail)}</td></tr>`).join("")}</tbody></table>`;
  if(!analysisDialog.open)analysisDialog.showModal();
}
function quickFocus(action) {
  const f=state.filters;
  Object.assign(f,{product:"",count:"",combo:"",ab:"",role:null,purchaseType:"",revenueClass:"",productStatus:null,aSubset:false});
  if(action==="a-only")Object.assign(f,{product:"A",count:"1"});
  if(action==="a-missing-b")Object.assign(f,{product:"A",productStatus:{code:"B",owned:false},aSubset:true});
  if(action==="multi")f.count="2+";
  analysisDialog.close();
  render();
}
document.addEventListener("click",event=>{
  if(event.target.closest("#closeAnalysis")){
    analysisDialog.close();return;
  }
  const focus=event.target.closest("[data-focus]");
  if(focus){quickFocus(focus.dataset.focus);return;}
  const detail=event.target.closest("[data-detail]");
  if(detail){openAnalysis(detail.dataset.detail,detail);return;}
  const clear=event.target.closest("[data-clear]");
  if(clear) {
    const key=clear.dataset.clear;
    state.filters[key]=["role","productStatus"].includes(key)?null:key==="year"?2025:"";
    if(key==="productStatus")state.filters.aSubset=false;
    render();
    return;
  }
  const chartTarget=event.target.closest("[data-filter]");
  if(chartTarget){if(analysisDialog.open)analysisDialog.close();handleChartFilter(chartTarget.dataset.filter);}
});
document.getElementById("overviewBtn").addEventListener("click",()=>openAnalysis("overview"));
const yearInfoDialog=document.getElementById("yearInfoDialog");
document.getElementById("yearLogic").addEventListener("click",()=>{hideTooltip();yearInfoDialog.showModal();});
document.getElementById("closeYearInfo").addEventListener("click",()=>yearInfoDialog.close());
yearInfoDialog.addEventListener("click",event=>{if(event.target===yearInfoDialog)yearInfoDialog.close();});
analysisDialog.addEventListener("click",event=>{if(event.target===analysisDialog)analysisDialog.close();});
document.addEventListener("keydown",event=>{
  if((event.key==="Enter"||event.key===" ")&&event.target.hasAttribute("data-filter")) {
    event.preventDefault();
    handleChartFilter(event.target.dataset.filter);
  }
});
for(const [id,key] of [["filterYear","year"],["filterSize","size"],["filterIndustry","industry"],["filterCity","city"],
  ["filterProduct","product"],["filterCount","count"]]){
  document.getElementById(id).addEventListener("change",event=>{
    state.filters[key]=key==="year"?Number(event.target.value):event.target.value;
    render();
  });
}
document.getElementById("resetFilters").addEventListener("click",resetFilters);
document.getElementById("drillDown").addEventListener("click",()=>moveDrill(1));
document.getElementById("drillUp").addEventListener("click",()=>moveDrill(-1));
function fitStage() {
  const slot=document.getElementById("stageSlot"),slide=document.getElementById("presentationStage");
  if(!slot || !slide)return;
  const compact=window.innerWidth<1000;
  document.body.classList.toggle("compact",compact);
  if(compact){
    slot.style.width="100%";
    slot.style.height="auto";
    slide.style.transform="none";
    return;
  }
  const fullscreen=document.fullscreenElement===slot;
  const horizontalGap=fullscreen?0:20;
  const verticalGap=fullscreen?0:70;
  const scale=Math.min((window.innerWidth-horizontalGap)/1920,(window.innerHeight-verticalGap)/1080);
  slot.style.width=(1920*scale)+"px";
  slot.style.height=(1080*scale)+"px";
  slide.style.transform=`scale(${scale})`;
}
document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>{
  state.view=Number(button.dataset.view);
  render();
  window.scrollTo({top:0,behavior:"smooth"});
}));
document.addEventListener("change",e=>{
  if(e.target.id==="combos"){state.combo=e.target.value;render();}
  if(e.target.id==="segment"){state.segment=e.target.value;render();}
});
document.getElementById("printBtn").addEventListener("click",()=>window.print());
document.getElementById("fullBtn").addEventListener("click",async()=>{
  const slot=document.getElementById("stageSlot");
  if(document.fullscreenElement)await document.exitFullscreen();
  else if(slot.requestFullscreen)await slot.requestFullscreen();
  fitStage();
});
window.addEventListener("resize",fitStage);
document.addEventListener("fullscreenchange",fitStage);
fitStage();
const tip=document.getElementById("tooltip");
function hideTooltip(){
  const element=document.getElementById("tooltip");
  if(element)element.classList.remove("show");
}
document.addEventListener("pointerover",e=>{
  const el=e.target.closest("[data-tip]");
  if(!el)return;
  tip.textContent=el.dataset.tip;
  tip.classList.add("show");
});
document.addEventListener("pointermove",e=>{
  if(!tip.classList.contains("show"))return;
  tip.style.left=Math.min(e.clientX+13,window.innerWidth-tip.offsetWidth-12)+"px";
  tip.style.top=Math.min(e.clientY+15,window.innerHeight-tip.offsetHeight-12)+"px";
});
document.addEventListener("pointerout",e=>{
  const el=e.target.closest("[data-tip]");
  if(el && !el.contains(e.relatedTarget))hideTooltip();
});
document.addEventListener("pointerdown",hideTooltip,{capture:true});
document.addEventListener("scroll",hideTooltip,{capture:true,passive:true});
window.addEventListener("blur",hideTooltip);
document.addEventListener("visibilitychange",hideTooltip);
analysisDialog.addEventListener("close",hideTooltip);
Promise.all(["./cohorts.json","./sequence-summary.json"].map(url=>fetch(url).then(res=>{
  if(!res.ok)throw new Error("Không tải được dữ liệu");
  return res.json();
}))).then(([cohorts,summary])=>{COHORTS=cohorts;SEQUENCE_SUMMARY=summary;render();}).catch(err=>{
  document.getElementById("dashboard").innerHTML=`<div class="loading error">${esc(err.message)}. Vui lòng tải lại trang.</div>`;
});
