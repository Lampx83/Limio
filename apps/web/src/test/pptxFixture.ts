// Dựng file .pptx tối giản (đúng cấu trúc OOXML mà bộ đọc dùng) cho test và cho file thử E2E.
// Không nhằm mở được bằng PowerPoint với mọi chi tiết; chỉ đủ các phần: presentation, slide, layout, notes,
// media, bảng, biểu đồ, SmartArt.

import JSZip from "jszip";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// PNG 1×1 hợp lệ.
export const TINY_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

export type FxPara = string | { text: string; lvl?: number; num?: boolean };

export interface FxSlide {
  title?: string;
  titleType?: "title" | "ctrTitle";
  subtitle?: string[];
  body?: FxPara[];
  textBoxes?: Array<{ text: string; y: number; x?: number }>;
  notes?: string;
  hidden?: boolean;
  layout?: string;
  images?: Array<{ name: string; cx: number; cy: number; bytes?: Uint8Array }>;
  table?: string[][];
  chart?: { type: "bar" | "hbar" | "line" | "pie" | "doughnut"; title?: string; labels: string[]; series: Array<{ name: string; values: number[] }>; percent?: boolean };
  smartArt?: Array<{ text: string; children?: string[] }>;
  shapes?: string[];
  video?: boolean;
  animated?: boolean;
  equation?: string;
}

const W = 12192000;
const H = 6858000;

const para = (p: FxPara) => {
  const o = typeof p === "string" ? { text: p } : p;
  const pPr = o.lvl || o.num ? `<a:pPr${o.lvl ? ` lvl="${o.lvl}"` : ""}>${o.num ? '<a:buAutoNum type="arabicPeriod"/>' : ""}</a:pPr>` : "";
  return `<a:p>${pPr}<a:r><a:rPr lang="vi-VN"/><a:t>${esc(o.text)}</a:t></a:r></a:p>`;
};

const sp = (id: number, ph: string | null, paras: FxPara[], opts: { y?: number; x?: number; txBox?: boolean; geom?: string } = {}) => {
  const phXml = ph ? `<p:nvPr><p:ph${ph === "body" ? ' idx="1"' : ` type="${ph}"`}/></p:nvPr>` : "<p:nvPr/>";
  const xfrm = opts.y !== undefined ? `<a:xfrm><a:off x="${opts.x ?? 457200}" y="${opts.y}"/><a:ext cx="8000000" cy="900000"/></a:xfrm>` : "";
  const geom = opts.geom ? `<a:prstGeom prst="${opts.geom}"><a:avLst/></a:prstGeom>` : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="S${id}"/><p:cNvSpPr${opts.txBox ? ' txBox="1"' : ""}/>${phXml}</p:nvSpPr><p:spPr>${xfrm}${geom}</p:spPr><p:txBody><a:bodyPr/>${paras.map(para).join("")}</p:txBody></p:sp>`;
};

export async function buildPptx(slides: FxSlide[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const layouts = [...new Set(slides.map((s) => s.layout ?? "obj"))];
  const presRels: string[] = [];
  const sldIds: string[] = [];
  let chartNo = 0;
  let dataNo = 0;

  layouts.forEach((t, i) => {
    zip.file(`ppt/slideLayouts/slideLayout${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${NS} type="${t}"><p:cSld><p:spTree/></p:cSld></p:sldLayout>`);
  });

  slides.forEach((s, i) => {
    const n = i + 1;
    // Thứ tự trong presentation.xml đảo tên file để thử việc đọc theo sldIdLst chứ không theo tên.
    const file = `slide${slides.length - i}.xml`;
    const rels: string[] = [`<Relationship Id="rLayout" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${layouts.indexOf(s.layout ?? "obj") + 1}.xml"/>`];
    const tree: string[] = [];
    let id = 2;
    if (s.title !== undefined) tree.push(sp(id++, s.titleType ?? "title", [s.title]));
    if (s.subtitle?.length) tree.push(sp(id++, "subTitle", s.subtitle));
    if (s.body?.length) tree.push(sp(id++, "body", s.body));
    for (const tb of s.textBoxes ?? []) tree.push(sp(id++, null, [tb.text], { y: tb.y, x: tb.x, txBox: true }));
    for (const [k, t] of (s.shapes ?? []).entries()) tree.push(sp(id++, null, [t], { y: 2000000, x: 500000 + k * 2500000, geom: "roundRect" }));
    tree.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Num"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:p><a:fld id="{1}" type="slidenum"><a:t>${n}</a:t></a:fld></a:p></p:txBody></p:sp>`);
    if (s.equation) {
      tree.push(
        `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="a14">${sp(id++, null, [], { y: 4000000, txBox: true }).replace(
          "<a:bodyPr/>",
          `<a:bodyPr/><a:p><a14:m xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main"><m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"><m:oMath><m:r><m:t>${esc(s.equation)}</m:t></m:r></m:oMath></m:oMathPara></a14:m></a:p>`,
        )}</mc:Choice><mc:Fallback><p:sp><p:nvSpPr><p:cNvPr id="99" name="F"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:p><a:r><a:t>FALLBACK</a:t></a:r></a:p></p:txBody></p:sp></mc:Fallback></mc:AlternateContent>`,
      );
    }
    for (const [k, im] of (s.images ?? []).entries()) {
      const rid = `rImg${k}`;
      rels.push(`<Relationship Id="${rid}" Type="${REL}/image" Target="../media/${im.name}"/>`);
      zip.file(`ppt/media/${im.name}`, im.bytes ?? TINY_PNG);
      tree.push(
        `<p:pic><p:nvPicPr><p:cNvPr id="${id++}" name="P${k}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${im.cx}" cy="${im.cy}"/></a:xfrm></p:spPr></p:pic>`,
      );
    }
    if (s.video) {
      tree.push(`<p:pic><p:nvPicPr><p:cNvPr id="${id++}" name="V"/><p:cNvPicPr/><p:nvPr><a:videoFile r:link="rVid"/></p:nvPr></p:nvPicPr><p:blipFill><a:blip/></p:blipFill><p:spPr/></p:pic>`);
    }
    if (s.table) {
      const rows = s.table.map((r) => `<a:tr h="370840">${r.map((c) => `<a:tc><a:txBody><a:bodyPr/>${para(c)}</a:txBody></a:tc>`).join("")}</a:tr>`).join("");
      tree.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="T"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="0" y="0"/><a:ext cx="8000000" cy="3000000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid/>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`,
      );
    }
    if (s.chart) {
      chartNo += 1;
      rels.push(`<Relationship Id="rChart" Type="${REL}/chart" Target="../charts/chart${chartNo}.xml"/>`);
      tree.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="C"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rChart"/></a:graphicData></a:graphic></p:graphicFrame>`,
      );
      const c = s.chart;
      const tag = c.type === "hbar" ? "barChart" : `${c.type}Chart`;
      const dir = c.type === "bar" ? '<c:barDir val="col"/>' : c.type === "hbar" ? '<c:barDir val="bar"/>' : "";
      const fmt = c.percent ? "<c:formatCode>0%</c:formatCode>" : "<c:formatCode>General</c:formatCode>";
      const sers = c.series
        .map(
          (se, k) =>
            `<c:ser><c:idx val="${k}"/><c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${esc(se.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx><c:cat><c:strRef><c:strCache><c:ptCount val="${c.labels.length}"/>${c.labels.map((l, j) => `<c:pt idx="${j}"><c:v>${esc(l)}</c:v></c:pt>`).join("")}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:numCache>${fmt}<c:ptCount val="${se.values.length}"/>${se.values.map((v, j) => `<c:pt idx="${j}"><c:v>${v}</c:v></c:pt>`).join("")}</c:numCache></c:numRef></c:val></c:ser>`,
        )
        .join("");
      const title = c.title ? `<c:title><c:tx><c:rich><a:p><a:r><a:t>${esc(c.title)}</a:t></a:r></a:p></c:rich></c:tx></c:title>` : "";
      zip.file(
        `ppt/charts/chart${chartNo}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><c:chart>${title}<c:plotArea><c:${tag}>${dir}${sers}</c:${tag}></c:plotArea></c:chart></c:chartSpace>`,
      );
    }
    if (s.smartArt) {
      dataNo += 1;
      rels.push(`<Relationship Id="rDm" Type="${REL}/diagramData" Target="../diagrams/data${dataNo}.xml"/>`);
      tree.push(
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="D"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"><dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rDm" r:lo="x" r:qs="y" r:cs="z"/></a:graphicData></a:graphic></p:graphicFrame>`,
      );
      const pts: string[] = ['<dgm:pt modelId="doc" type="doc"><dgm:t><a:bodyPr/><a:p><a:endParaRPr/></a:p></dgm:t></dgm:pt>'];
      const cxns: string[] = [];
      s.smartArt.forEach((node, k) => {
        pts.push(`<dgm:pt modelId="n${k}"><dgm:t><a:bodyPr/><a:p><a:r><a:t>${esc(node.text)}</a:t></a:r></a:p></dgm:t></dgm:pt>`);
        pts.push(`<dgm:pt modelId="t${k}" type="parTrans"/><dgm:pt modelId="s${k}" type="sibTrans"/><dgm:pt modelId="pres${k}" type="pres"><dgm:t><a:p><a:r><a:t>RÁC</a:t></a:r></a:p></dgm:t></dgm:pt>`);
        cxns.push(`<dgm:cxn modelId="c${k}" srcId="doc" destId="n${k}" srcOrd="${k}" destOrd="0"/>`);
        cxns.push(`<dgm:cxn modelId="p${k}" type="presOf" srcId="n${k}" destId="pres${k}" srcOrd="0" destOrd="0"/>`);
        (node.children ?? []).forEach((ch, j) => {
          pts.push(`<dgm:pt modelId="n${k}c${j}"><dgm:t><a:bodyPr/><a:p><a:r><a:t>${esc(ch)}</a:t></a:r></a:p></dgm:t></dgm:pt>`);
          cxns.push(`<dgm:cxn modelId="c${k}c${j}" srcId="n${k}" destId="n${k}c${j}" srcOrd="${j}" destOrd="0"/>`);
        });
      });
      zip.file(
        `ppt/diagrams/data${dataNo}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><dgm:ptLst>${pts.join("")}</dgm:ptLst><dgm:cxnLst>${cxns.join("")}</dgm:cxnLst></dgm:dataModel>`,
      );
    }
    if (s.notes !== undefined) {
      rels.push(`<Relationship Id="rNotes" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/>`);
      const nparas = s.notes.split("\n").map((l) => `<a:p>${l ? `<a:r><a:t>${esc(l)}</a:t></a:r>` : ""}</a:p>`).join("");
      zip.file(
        `ppt/notesSlides/notesSlide${n}.xml`,
        `<?xml version="1.0" encoding="UTF-8"?><p:notes ${NS}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="Img"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>${nparas}</p:txBody></p:sp></p:spTree></p:cSld></p:notes>`,
      );
    }
    const timing = s.animated ? '<p:timing><p:tnLst><p:par><p:cTn id="1"><p:childTnLst><p:par><p:cTn id="2" presetID="10" presetClass="entr"/></p:par></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>' : "";
    zip.file(
      `ppt/slides/${file}`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS}${s.hidden ? ' show="0"' : ""}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${tree.join("")}</p:spTree></p:cSld>${timing}</p:sld>`,
    );
    zip.file(`ppt/slides/_rels/${file}.rels`, `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`);
    presRels.push(`<Relationship Id="rId${n + 10}" Type="${REL}/slide" Target="slides/${file}"/>`);
    sldIds.push(`<p:sldId id="${255 + n}" r:id="rId${n + 10}"/>`);
  });

  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${NS}><p:sldIdLst>${sldIds.join("")}</p:sldIdLst><p:sldSz cx="${W}" cy="${H}"/></p:presentation>`,
  );
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels.join("")}</Relationships>`);
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  return zip.generateAsync({ type: "uint8array" });
}

export const SLIDE_W = W;
export const SLIDE_H = H;
