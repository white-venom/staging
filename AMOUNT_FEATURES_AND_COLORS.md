# CrediiFlow — Amount Flow & Color Master Tables
### (कहाँ से कहाँ जा रहा है Amount और उसका Exact Color Code)

---

## 📊 1. Master Table (विस्तृत और स्पष्ट टेबल)

| # | Feature / Action | कहाँ से (From) | कहाँ को (To) | Staff Pocket Color | Retailer Ledger Color | Bank / Portal Color | आसान मतलब (Plain Meaning) |
|:---:|---|---|---|:---:|:---:|:---:|---|
| **1** | **Retailer Cash Collection** | Retailer (दुकानदार) | Staff Pocket (स्टाफ) | 🟢 **GREEN** (+In) | 🔴 **RED** (Received) | — | दुकानदार ने कैश दिया, स्टाफ की जेब में आया |
| **2** | **Virtual Transfer (Load)** | Portal (पोर्टल) | Retailer (दुकानदार) | — | 🟢 **GREEN** (You Gave) | 🔴 **RED** (Out) | पोर्टल से दुकानदार को बैलेंस दिया (लोड) |
| **3** | **Virtual Refund (Return)** | Retailer (दुकानदार) | Portal (पोर्टल) | — | 🔴 **RED** (Debit) | 🟢 **GREEN** (In) | दुकानदार से बैलेंस वापस पोर्टल पर लिया |
| **4** | **Bank Cash Deposit** | Staff Pocket (स्टाफ) | Bank Account (बैंक) | 🔴 **RED** (-Out) | — | 🟢 **GREEN** (Deposit) | स्टाफ ने जेब का कैश बैंक में जमा किया |
| **5** | **Staff Handover (भेजना)** | Staff A (देने वाला) | Staff B (लेने वाला) | 🔴 **RED** (-Out) | — | — | स्टाफ A की जेब से कैश निकला |
| **6** | **Staff Handover (पाना)** | Staff A (देने वाला) | Staff B (लेने वाला) | 🟢 **GREEN** (+In) | — | — | स्टाफ B की जेब में कैश आया |
| **7** | **Office Cash Handover** | Staff Pocket (स्टाफ) | Main Office (मेन ऑफिस) | 🔴 **RED** (-Out) | — | 🟢 **GREEN** (Office In) | स्टाफ ने सीधे ऑफिस में कैश दिया |
| **8** | **Bank to Bank Transfer** | Bank A (सोर्स) | Bank B (डेस्टिनेशन) | — | — | 🔴 Bank A / 🟢 Bank B | एक बैंक खाते से दूसरे बैंक खाते में गया |
| **9** | **Portal Credit Adjustment** | Admin (एडमिन) | Portal (पोर्टल) | — | — | 🟢 **GREEN** (Credit) | एडमिन ने पोर्टल बैलेंस बढ़ाया |
| **10** | **Portal Debit Adjustment** | Portal (पोर्टल) | Admin (एडमिन) | — | — | 🔴 **RED** (Debit) | एडमिन ने पोर्टल बैलेंस घटाया |
| **11** | **Opening Balance (To Take)**| System (सिस्टम) | Retailer (दुकानदार) | — | 🔴 **RED** (To Take) | — | दुकानदार से पुराना उधार लेना है |
| **12** | **Opening Balance (To Give)**| Retailer (दुकानदार) | Business (कंपनी) | — | 🟢 **GREEN** (To Give) | — | दुकानदार का एडवांस पैसा देना है |
| **13** | **Net Cash in Hand** | Total In − Total Out | Staff Pocket (जेब) | 🔵 **BLUE** (Net Cash) | — | — | दिन का कुल बचा हुआ कैश बैलेंस |
| **14** | **Late Attendance Penalty** | Staff (स्टाफ) | System (सिस्टम) | 🔴 **RED** / 🟡 **AMBER** | — | — | लेट आने पर जुर्माना कटा |

---

## 🏪 2. Retailer-Wise Live Examples (दुकानदारों के नाम के साथ उदाहरण)

| Retailer / Party Name | Action / Transaction | Source ➔ Destination | Amount | Ledger Color | Pocket Color | Meaning (मतलब) |
|---|---|---|---|:---:|:---:|---|
| **Sharma Mobile Store** | Cash Collection | Sharma Mobile ➔ Staff Pocket | ₹5,000 | 🔴 **RED** | 🟢 **GREEN** | Sharma ji ne ₹5,000 cash diya |
| **Sharma Mobile Store** | Virtual Transfer (Load) | Portal ➔ Sharma Mobile Wallet | ₹10,000 | 🟢 **GREEN** | — | Sharma ji ko ₹10,000 load diya (You Gave) |
| **Sharma Mobile Store** | Move to Distributor (Refund) | Sharma Mobile ➔ Portal | ₹2,000 | 🔴 **RED** | — | Sharma ji se ₹2,000 refund wapas liya |
| **Gupta General Store** | Opening Balance (To Take) | System ➔ Gupta Store | ₹15,000 | 🔴 **RED** | — | Gupta Store se ₹15,000 udhaar lena hai |
| **Gupta General Store** | Opening Balance (To Give) | Gupta Store ➔ Business | ₹3,000 | 🟢 **GREEN** | — | Gupta Store ka ₹3,000 advance jama hai |
| **Verma Telecom** | Full Cash Collection | Verma Telecom ➔ Staff Pocket | ₹8,500 | 🔴 **RED** | 🟢 **GREEN** | Verma ji se ₹8,500 collect hua |
| **CMS Retailer** | Cash Inflow (CMS) | CMS ➔ Staff Pocket | ₹12,000 | 🔴 **RED** | 🟢 **GREEN** | CMS collection complete hui |

---

## 📂 3. Category-Wise Sub Tables (केटेगरी अनुसार अलग-अलग टेबल)

### A. Retailer & Party Transactions (दुकानदार लेन-देन)

| Action | From (कहाँ से) | To (कहाँ को) | Ledger Color | Pocket Color | Meaning |
|---|---|---|:---:|:---:|---|
| **Cash Collection** | Retailer (e.g. Sharma Mobile) | Staff Pocket | 🔴 **RED** | 🟢 **GREEN** | Retailer se payment receive hui |
| **Virtual Load (Topup)** | Portal (e.g. RevaPay) | Retailer Wallet | 🟢 **GREEN** | — | Retailer ko load transfer kiya |
| **Virtual Refund (Return)** | Retailer Wallet | Portal | 🔴 **RED** | — | Retailer se portal pe balance wapas liya |
| **Opening (To Take - लेना है)**| System | Retailer Khata | 🔴 **RED** | — | Retailer par udhaar baaki hai |
| **Opening (To Give - देना है)**| Retailer | Business | 🟢 **GREEN** | — | Retailer ka advance jama hai |

---

### B. Staff Pocket & Cash Handover (स्टाफ जेब और कैश मूवमेंट)

| Action | From (कहाँ से) | To (कहाँ को) | Sender Staff Color | Receiver Staff Color | Meaning |
|---|---|---|:---:|:---:|---|
| **Cash-In Collection** | Retailer | Staff Pocket | — | 🟢 **GREEN** (+In) | Pocket mein cash aaya |
| **Bank Cash Deposit** | Staff Pocket | Bank Account | 🔴 **RED** (-Out) | — | Pocket se cash bank mein jama |
| **Staff to Staff Handover** | Staff A | Staff B | 🔴 **RED** (-Out) | 🟢 **GREEN** (+In) | Ek staff se dusre staff ko cash |
| **Office Cash Handover** | Staff Pocket | Main Office | 🔴 **RED** (-Out) | 🟢 **GREEN** (Office) | Pocket se direct office mein jama |
| **Net Cash in Hand Total** | Staff Pocket | Staff Pocket | 🔵 **BLUE** | 🔵 **BLUE** | Pocket ka total bacha cash |

---

### C. Bank Accounts & Portal Balance (बैंक और पोर्टल)

| Action | From (कहाँ से) | To (कहाँ को) | Source Color | Destination Color | Meaning |
|---|---|---|:---:|:---:|---|
| **Bank Deposit Received** | Staff Pocket | Bank Account | — | 🟢 **GREEN** | Bank balance badha |
| **Bank to Bank Transfer** | Bank A | Bank B | 🔴 **RED** | 🟢 **GREEN** | Ek bank se dusre bank transfer |
| **Portal Virtual Load Out** | Portal | Retailer Wallet | 🔴 **RED** | — | Portal se virtual balance ghata |
| **Portal Refund In** | Retailer Wallet | Portal | — | 🟢 **GREEN** | Portal balance wapas restore hua |
| **Portal Admin Credit** | Admin | Portal | — | 🟢 **GREEN** | Portal balance add kiya |
| **Portal Admin Debit** | Portal | Admin | 🔴 **RED** | — | Portal balance deduct kiya |

---

## 🎨 4. Color Codes & CSS Tokens

| Color | Text Class | Background Class | Hex Code | Financial Role |
|:---:|---|---|---|---|
| 🟢 **GREEN** | `text-emerald-600` | `bg-emerald-50` | `#059669` | **+ Cash In / You Gave / Credit / To Give** |
| 🔴 **RED** | `text-red-600` | `bg-red-50` | `#dc2626` | **- Cash Out / You Got / Debit / To Take** |
| 🔵 **BLUE** | `text-blue-600` | `bg-blue-50` | `#2563eb` | **Net Total / Cash in Hand / Summary** |
| ⚪ **SLATE** | `text-slate-500` | `bg-slate-100` | `#64748b` | **₹0 Zero Balance / Settled** |
| 🟡 **AMBER** | `text-amber-600` | `bg-amber-50` | `#d97706` | **Warning / Offline Alert / Late Fine** |
