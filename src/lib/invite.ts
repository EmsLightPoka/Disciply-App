import { DEFAULT_SETTINGS, type InviteCard, type Settings } from "./types";
import { fromIso, nextSunday, today } from "./dates";

export const card = (s: Settings): InviteCard => ({ ...DEFAULT_SETTINGS.inviteCard!, ...(s.inviteCard ?? {}) });

/** Remplace les mots entre accolades : {prenom}, {jour}… */
export const fill = (tpl: string, v: Record<string, string>) => tpl.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m);

/** Le dimanche qui vient (ou aujourd'hui si c'est dimanche), en toutes lettres. */
export function sundayLabel() {
  const d = new Date().getDay() === 0 ? today() : nextSunday();
  return fromIso(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function inviteText(s: Settings, soulName: string, makerName: string) {
  const c = card(s);
  return fill(s.inviteMessage ?? DEFAULT_SETTINGS.inviteMessage!, {
    prenom: soulName.split(" ")[0], jour: sundayLabel(), heure: c.time, lieu: c.place, eglise: s.churchName, faiseur: makerName.split(" ")[0]
  });
}

const wrap = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) => {
  const words = text.split(" "); let line = ""; let yy = y;
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > max && line) { ctx.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
  if (line) ctx.fillText(line, x, yy);
  return yy + lh;
};

/** Le billet d'invitation, en image (1080 × 1350), aux couleurs de l'église. */
export async function inviteImage(s: Settings, firstName?: string): Promise<Blob> {
  const c = card(s);
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  await document.fonts?.ready;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, c.color1); g.addColorStop(1, c.color2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Arc décoratif
  ctx.strokeStyle = c.accent; ctx.globalAlpha = .18; ctx.lineWidth = 90; ctx.beginPath(); ctx.arc(W - 60, 140, 300, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  try {
    const img = new Image(); img.src = "/logo-white.png"; await img.decode();
    const w = 380, h = (img.height / img.width) * w; ctx.drawImage(img, 90, 90, w, h);
  } catch { /* pas de logo */ }
  ctx.fillStyle = "#fff"; ctx.textAlign = "left";
  ctx.font = "600 44px 'Plus Jakarta Sans', sans-serif"; ctx.globalAlpha = .85;
  ctx.fillText(firstName ? `${firstName},` : s.churchName, 90, 420); ctx.globalAlpha = 1;
  ctx.font = "800 104px 'Plus Jakarta Sans', sans-serif";
  let y = wrap(ctx, c.title, 90, 540, W - 180, 116);
  const bar = ctx.createLinearGradient(90, 0, 450, 0); bar.addColorStop(0, "#FEC604"); bar.addColorStop(.5, "#FE9B02"); bar.addColorStop(1, "#FF7203");
  ctx.fillStyle = bar; ctx.fillRect(90, y - 50, 260, 14);
  ctx.fillStyle = "#fff"; ctx.font = "600 54px 'Plus Jakarta Sans', sans-serif";
  y = wrap(ctx, c.subtitle, 90, y + 60, W - 180, 66);
  ctx.font = "500 46px Inter, sans-serif";
  const label = sundayLabel(); y = wrap(ctx, label.charAt(0).toUpperCase() + label.slice(1), 90, y + 20, W - 180, 60);
  ctx.fillStyle = c.accent; ctx.font = "700 46px Inter, sans-serif"; y = wrap(ctx, c.time, 90, y + 4, W - 180, 58);
  ctx.fillStyle = "#fff"; ctx.font = "500 42px Inter, sans-serif"; y = wrap(ctx, c.place, 90, y + 4, W - 180, 56);
  ctx.font = "italic 400 38px Fraunces, Georgia, serif"; ctx.globalAlpha = .85; wrap(ctx, c.verse, 90, H - 170, W - 180, 50); ctx.globalAlpha = 1;
  return await new Promise(r => cv.toBlob(b => r(b!), "image/png"));
}

/** Partage l'image (WhatsApp sur téléphone) ou la télécharge sur ordinateur. */
export async function shareImage(blob: Blob, text: string) {
  const file = new File([blob], "invitation-culte.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); return "shared"; } catch { return "cancelled"; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "invitation-culte.png"; a.click();
  return "downloaded";
}

export const waLink = (phone: string, text: string) => {
  let n = phone.replace(/[^\d+]/g, "").replace(/^\+/, ""); if (n.length <= 9) n = "237" + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};
export const smsLink = (phone: string, text: string) => `sms:${phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(text)}`;
