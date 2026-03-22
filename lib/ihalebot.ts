// app/ihalebot.ts
import { db } from "@/lib/db";
import { chromium, Browser, Page } from "playwright-core";
import nodemailer from "nodemailer";

// ------------------------------
// Tip tanımlamaları
// ------------------------------
type ParsedTender = {
  rawText: string;
  title: string;
  city: string;
  publishDate: string;
  deadline: string;
  category: string;
  institution: string;
  participants: string[];
  materialList: { kalem: string; miktar: string; birim: string }[];
  announcementText: string;
  techDocUrl: string;
  adminDocUrl: string;
  techDocFilename: string;
  adminDocFilename: string;
};

const CATEGORY_IDS = [
  "6", "24", "5", "37", "301", "302", "304"
];

// ------------------------------
// Yardımcı fonksiyonlar
// ------------------------------
function trLower(text: string) {
  return text.toLocaleLowerCase("tr-TR");
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractDate(text: string, label: string) {
  const re = new RegExp(
    `${label}\\s*:?\\s*(\\d{1,2}\\.\\d{1,2}\\.\\d{4}(?:\\s*\\d{2}:\\d{2})?)`,
    "i"
  );
  const m = text.match(re);
  return m?.[1] || "-";
}

function extractCity(text: string) {
  const cities = [
    "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin",
    "Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa",
    "Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum",
    "Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir",
    "Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kırıkkale","Kırklareli","Kırşehir",
    "Kilis","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir",
    "Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Siirt","Sinop","Sivas","Şanlıurfa","Şırnak",
    "Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak",
  ];

  if (/\bBursa\b/i.test(text)) return "Bursa";
  for (const city of cities) {
    if (new RegExp(`\\b${city}\\b`, "i").test(text)) return city;
  }
  return "-";
}

function extractCategory(text: string) {
  const lower = trLower(text);
  if (lower.includes("yangın")) return "Yangın Sistemleri";
  if (lower.includes("klima") || lower.includes("havalandırma") || lower.includes("iklimleme"))
    return "Klima / Havalandırma";
  if (lower.includes("doğalgaz") || lower.includes("gaz tesisatı"))
    return "Doğalgaz / Gaz Tesisatı";
  if (lower.includes("sıhhi") || lower.includes("tesisat"))
    return "Sıhhi Tesisat";
  if (lower.includes("mühendislik"))
    return "Mühendislik / Danışmanlık";
  if (lower.includes("boru"))
    return "Boru / Altyapı";
  if (lower.includes("ısıtma"))
    return "Isıtma Sistemleri";
  return "-";
}

function parseTender(rawText: string, extras?: Partial<ParsedTender>): ParsedTender {
  const text = cleanText(rawText);
  const lines = rawText.split("\n").map(x => x.trim()).filter(Boolean);
  let title = lines[0] || "İhale Kaydı";
  title = title.replace(/^#?\d+\s*/, "").trim();
  const institutionMatch = rawText.match(/İdare adı\s*:\s*([^\n]+)/i);
  const institution = institutionMatch?.[1]?.trim() || "-";

  return {
    rawText: text,
    title,
    city: extractCity(rawText),
    publishDate: extractDate(rawText, "Yayın tarihi"),
    deadline: extractDate(rawText, "Teklif tarihi"),
    category: extractCategory(rawText),
    institution,
    participants: [],
    materialList: [],
    announcementText: "",
    techDocUrl: "",
    adminDocUrl: "",
    techDocFilename: "",
    adminDocFilename: "",
    ...extras,
  };
}

// ------------------------------
// E-posta gönderme (zengin içerik)
// ------------------------------
async function sendMail(tenders: ParsedTender[]) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const recipients = (process.env.EMAIL_TO || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f3f6fb;padding:24px;">
      <div style="max-width:980px;margin:0 auto;">
        <div style="background:#0b5ed7;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0;">
          <div style="font-size:26px;font-weight:700;">Yeni Uygun İhaleler</div>
          <div style="font-size:13px;opacity:.95;margin-top:6px;">Atalay Mekanik otomatik ihale takip bildirimi</div>
        </div>
        <div style="background:#fff;border:1px solid #dbe4f0;border-top:none;border-radius:0 0 14px 14px;padding:22px;">
          ${
            tenders.length === 0
              ? `<div style="padding:16px;border:1px solid #e5e7eb;border-radius:10px;">Uygun ihale bulunamadı.</div>`
              : tenders.map((item, index) => `
                <div style="border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:16px;background:#fff;">
                  <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:12px;">
                    ${index + 1}. ${escapeHtml(item.title)}
                  </div>
                  <table style="width:100%;border-collapse:collapse;font-size:14px;">
                       <tr><td style="padding:6px 0;width:160px;color:#6b7280;font-weight:700;">İdare / Kurum</td><td style="padding:6px 0;color:#111827;">${escapeHtml(item.institution)}</td></tr>
                       <tr><td style="padding:6px 0;color:#6b7280;font-weight:700;">Şehir</td><td style="padding:6px 0;color:#111827;">${escapeHtml(item.city)}</td></tr>
                       <tr><td style="padding:6px 0;color:#6b7280;font-weight:700;">Kategori</td><td style="padding:6px 0;color:#111827;">${escapeHtml(item.category)}</td></tr>
                       <tr><td style="padding:6px 0;color:#6b7280;font-weight:700;">Yayın Tarihi</td><td style="padding:6px 0;color:#111827;">${escapeHtml(item.publishDate)}</td></tr>
                       <tr><td style="padding:6px 0;color:#6b7280;font-weight:700;">Teklif Tarihi</td><td style="padding:6px 0;color:#111827;">${escapeHtml(item.deadline)}</td></tr>
                  </table>
                  ${item.participants.length > 0 ? `
                    <div style="margin-top:12px;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Muhtemel Katılımcılar</div>
                      <ul style="margin:0;padding-left:20px;">
                        ${item.participants.map(p => `<li>${escapeHtml(p)}</li>`).join("")}
                      </ul>
                    </div>
                  ` : ""}
                  ${item.materialList.length > 0 ? `
                    <div style="margin-top:12px;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Malzeme Listesi</div>
                      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #ddd;">
                        <thead><tr style="background:#f0f0f0;"><th style="border:1px solid #ddd;padding:4px;">Kalem</th><th style="border:1px solid #ddd;padding:4px;">Miktar</th><th style="border:1px solid #ddd;padding:4px;">Birim</th></tr></thead>
                        <tbody>
                          ${item.materialList.map(m => `
                            <tr>
                              <td style="border:1px solid #ddd;padding:4px;">${escapeHtml(m.kalem)}</td>
                              <td style="border:1px solid #ddd;padding:4px;">${escapeHtml(m.miktar)}</td>
                              <td style="border:1px solid #ddd;padding:4px;">${escapeHtml(m.birim)}</td>
                            </tr>
                          `).join("")}
                        </tbody>
                      </table>
                    </div>
                  ` : ""}
                  ${item.announcementText ? `
                    <div style="margin-top:12px;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">İhale İlanı Özeti</div>
                      <div style="background:#f9fafb;padding:8px;border-radius:4px;">${escapeHtml(item.announcementText.slice(0, 800))}${item.announcementText.length > 800 ? "..." : ""}</div>
                    </div>
                  ` : ""}
                  ${(item.techDocUrl || item.adminDocUrl) ? `
                    <div style="margin-top:12px;">
                      <div style="font-size:14px;font-weight:700;margin-bottom:6px;">Dokümanlar</div>
                      <ul style="margin:0;padding-left:20px;">
                        ${item.techDocUrl ? `<li><a href="${item.techDocUrl}" target="_blank">Teknik Şartname (${item.techDocFilename})</a></li>` : ""}
                        ${item.adminDocUrl ? `<li><a href="${item.adminDocUrl}" target="_blank">İdari Şartname (${item.adminDocFilename})</a></li>` : ""}
                      </ul>
                    </div>
                  ` : ""}
                  <div style="margin-top:14px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #eef2f7;">
                    <div style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:6px;">İçerik Özeti</div>
                    <div style="white-space:pre-line;line-height:1.5;color:#374151;font-size:13px;">
                      ${escapeHtml(item.rawText.slice(0, 800))}
                    </div>
                  </div>
                </div>
              `).join("")
          }
        </div>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Atalay Mekanik İhale Botu" <${process.env.EMAIL_USER}>`,
    to: recipients,
    subject: `ATALAY MEKANIK - Yeni Uygun İhaleler (${tenders.length})`,
    html,
  });

  console.log("MAIL GÖNDERİLDİ:", recipients);
}

// ------------------------------
// Detay sayfalarından veri çekme fonksiyonları
// ------------------------------
async function getParticipants(page: Page, tenderId: string): Promise<string[]> {
  await page.goto(`https://ihalebul.com/tender/${tenderId}/participants`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  return page.$$eval('#possibleparticipants table tbody tr', rows =>
    rows.map(row => row.querySelectorAll('td')[1]?.innerText.trim() || "").filter(Boolean)
  );
}

async function getMaterialList(page: Page, tenderId: string): Promise<{ kalem: string; miktar: string; birim: string }[]> {
  await page.goto(`https://ihalebul.com/tender/${tenderId}/6`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  return page.$$eval('#materials table tbody tr', rows =>
    rows.map(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        return {
          kalem: cells[1].innerText.trim(),
          miktar: cells[2].innerText.trim(),
          birim: cells[3].innerText.trim()
        };
      }
      return null;
    }).filter(Boolean) as { kalem: string; miktar: string; birim: string }[]
  );
}

async function getAnnouncementText(page: Page, tenderId: string): Promise<string> {
  await page.goto(`https://ihalebul.com/tender/${tenderId}/2`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const element = await page.$('.htmlcontent');
  if (element) {
    return await element.evaluate(el => (el as HTMLElement).innerText);
  }
  return "";
}

async function getDocumentLinks(page: Page, tenderId: string, docType: "7" | "8"): Promise<{ url: string; filename: string } | null> {
  await page.goto(`https://ihalebul.com/tender/${tenderId}/${docType}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const link = await page.$('a[href*="/download/"]');
  if (link) {
    const href = await link.getAttribute("href");
    const url = href ? new URL(href, "https://ihalebul.com").toString() : "";
    const filename = (await link.innerText()) || "";
    return { url, filename: filename.replace(/^Dokümanı indir\s*\([^)]+\)\s*/, "").trim() };
  }
  return null;
}

// ------------------------------
// Kart toplama
// ------------------------------
async function collectTenderCards(page: Page): Promise<{ id: string; text: string }[]> {
  const cardElements = await page.$$('div.card.border-secondary.my-2.mx-1');
  const cards: { id: string; text: string }[] = [];

  for (const card of cardElements) {
    const link = await card.$("a.details");
    let id = "";

    if (link) {
      const href = await link.getAttribute("href");
      const match = href ? href.match(/\/tender\/(\d+)/) : null;
      if (match) id = match[1];
    }

    const text = await card.evaluate(el => (el as HTMLElement).innerText.trim());
    if (text.length > 150 && id) cards.push({ id, text });
  }

  return cards;
}

// ------------------------------
// Sonraki sayfaya git - düzeltildi
// ------------------------------
async function goToNextPage(page: Page): Promise<boolean> {
  const nextButton = page.locator('a.page-link:has-text("Sonraki sayfa")').first();

  if ((await nextButton.count()) === 0) return false;

  const href = await nextButton.getAttribute("href");
  if (!href) return false;

  const currentUrl = page.url();
  const nextUrl = new URL(href, currentUrl).toString();

  if (nextUrl === currentUrl) return false;

  try {
    const parentLiClass = await nextButton.locator('xpath=..').getAttribute("class");
    if (parentLiClass?.includes("disabled")) {
      return false;
    }
  } catch {
    // parent okunamazsa devam et
  }

  await page.goto(nextUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);

  return page.url() !== currentUrl;
}

// ------------------------------
// Ana bot fonksiyonu
// ------------------------------
export async function runBot() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "tr-TR"
    });
    page = await context.newPage();

    // Giriş
    console.log("Giriş yapılıyor...");
    await page.goto("https://ihalebul.com/signin", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await page.waitForLoadState("networkidle");

    await page.locator('input[placeholder="Kullanıcı adı"]').last().fill("05441622416");
    await page.locator('input[placeholder="Şifre"]').last().fill("Yasin3641");
    await page.locator('input[placeholder="Şifre"]').last().press("Enter");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    console.log("Giriş yapıldı.");

    // Bursa + kategori filtresiyle arama sayfasına git
    const categoryParams = CATEGORY_IDS.map(id => `workcategory_in=${id}`).join("&");
    const searchUrl = `https://ihalebul.com/tenders/search?province_in=Bursa&${categoryParams}&display=advanced&views=show`;

    console.log("Arama URL'si:", searchUrl);

    await page.goto(searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Tüm sayfaları tara
    let allCards: { id: string; text: string }[] = [];
    let pageNo = 1;

    while (true) {
      console.log(`Sayfa ${pageNo} taranıyor...`);

      await page.waitForTimeout(1200);

      const cards = await collectTenderCards(page);
      console.log(`Sayfa ${pageNo} kart sayısı: ${cards.length}`);
      allCards.push(...cards);

      const moved = await goToNextPage(page);
      if (!moved) {
        console.log("Son sayfaya ulaşıldı.");
        break;
      }

      pageNo++;
    }

    // Benzersiz kartları ayıkla
    const uniqueCards = allCards.filter(
      (card, idx, self) => idx === self.findIndex(c => c.id === card.id)
    );

    console.log(`Toplam benzersiz kart sayısı: ${uniqueCards.length}`);

   // Tüm ilanları full detay çek
const tumIhaleler: ParsedTender[] = [];
const yeniIhaleler: ParsedTender[] = [];

for (const [index, card] of uniqueCards.entries()) {
  console.log(`Detay çekiliyor (${index + 1}/${uniqueCards.length}) - ID: ${card.id}`);

  const exists = await new Promise<boolean>((resolve, reject) => {
    db.get("SELECT id FROM ihaleler WHERE metin = ?", [card.text], (err, row) => {
      if (err) reject(err);
      else resolve(!!row);
    });
  });

  const participants = await getParticipants(page, card.id);
  const materialList = await getMaterialList(page, card.id);
  const announcementText = await getAnnouncementText(page, card.id);
  const techDoc = await getDocumentLinks(page, card.id, "8");
  const adminDoc = await getDocumentLinks(page, card.id, "7");

  const parsed = parseTender(card.text, {
    participants,
    materialList,
    announcementText,
    techDocUrl: techDoc?.url || "",
    adminDocUrl: adminDoc?.url || "",
    techDocFilename: techDoc?.filename || "",
    adminDocFilename: adminDoc?.filename || "",
  });

  tumIhaleler.push(parsed);

  if (!exists) {
    await new Promise<void>((resolve, reject) => {
      db.run(
        `INSERT INTO ihaleler (
          metin, participants, material_list, announcement_text,
          tech_doc_url, admin_doc_url, tech_doc_filename, admin_doc_filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          card.text,
          JSON.stringify(participants),
          JSON.stringify(materialList),
          announcementText,
          techDoc?.url || "",
          adminDoc?.url || "",
          techDoc?.filename || "",
          adminDoc?.filename || "",
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    yeniIhaleler.push(parsed);
  }

  await page.waitForTimeout(400);
}

console.log(`Toplam full detay ihale sayısı: ${tumIhaleler.length}`);
console.log(`Yeni ihale sayısı: ${yeniIhaleler.length}`);

// Artık mailde TÜM ihaleler gider
if (tumIhaleler.length > 0) {
  await sendMail(tumIhaleler);
  console.log(`${tumIhaleler.length} adet ihale full detay mail olarak gönderildi.`);
} else {
  console.log("Hiç ihale bulunamadı, e-posta gönderilmedi.");
}

await browser.close();

return {
  success: true,
  toplam: uniqueCards.length,
  uygun: uniqueCards.length,
  yeni: yeniIhaleler.length,
  liste: tumIhaleler,
};
  } catch (error) {
    console.error("Bot hatası:", error);

    if (page) {
      await page.screenshot({ path: "hata.png", fullPage: true });
    }

    if (browser) {
      await browser.close();
    }

    throw error;
  }
}