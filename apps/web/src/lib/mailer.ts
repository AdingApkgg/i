import { siteConfig } from "@i/config";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP mailer for friend-link notifications (MX Space style: new application →
 * owner; review result → applicant). Disabled silently when SMTP_HOST is unset
 * so the feature degrades to dash-only review.
 */

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    transporter = null;
    return null;
  }
  // `||` not `??`: compose 会把未设置的变量注入为空字符串。
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host,
    port,
    // 465 = implicit TLS; anything else defaults to STARTTLS. Override with SMTP_SECURE.
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url;
}

async function send(to: string, subject: string, html: string) {
  const t = getTransporter();
  if (!t) return;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || `"${siteConfig.title}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (e) {
    console.error("[mailer] send failed:", e instanceof Error ? e.message : e);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

interface FriendInfo {
  name: string;
  url: string;
  description?: string | null;
  email?: string | null;
  message?: string | null;
}

/** 新友链申请 → 站长 */
export async function notifyOwnerFriendApply(f: FriendInfo) {
  // `||` not `??`: compose 注入的空字符串不能吞掉 ADMIN_EMAIL 兜底。
  const to = process.env.FRIEND_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) return;
  const rows = (
    [
      ["名称", f.name],
      ["链接", f.url],
      ["描述", f.description ?? "—"],
      ["邮箱", f.email ?? "—"],
      ["留言", f.message ?? "—"],
    ] as [string, string][]
  )
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#888">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`,
    )
    .join("");
  await send(
    to,
    `新的友链申请：${f.name}`,
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.7">
      <p>「${esc(siteConfig.title)}」收到了一条新的友链申请：</p>
      <table style="border-collapse:collapse">${rows}</table>
      <p><a href="${siteUrl()}/dash/friends">→ 去后台审核</a></p>
    </div>`,
  );
}

/** 审核结果 → 申请人 */
export async function notifyApplicantReviewResult(f: FriendInfo, approved: boolean) {
  if (!f.email) return;
  const title = esc(siteConfig.title);
  const body = approved
    ? `<p>你在「${title}」提交的友链申请已经通过啦 ✿</p>
       <p>现在可以在 <a href="${siteUrl()}/friends">${siteUrl()}/friends</a> 找到「${esc(f.name)}」。</p>`
    : `<p>很抱歉，你在「${title}」提交的友链申请（${esc(f.name)}）没有通过审核。</p>
       <p>如有疑问欢迎邮件联系，调整后也可以重新提交。</p>`;
  await send(
    f.email,
    approved ? `友链申请已通过 — ${siteConfig.title}` : `友链申请未通过 — ${siteConfig.title}`,
    `<div style="font-family:sans-serif;font-size:14px;line-height:1.7">${body}</div>`,
  );
}
