// Shared Share & Format Helpers used across Staff and Admin panels

export const numberToWordsIndian = (num: number): string => {
  const absNum = Math.abs(num);
  if (absNum === 0) return "Zero";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const helper = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + helper(n % 100) : "");
    if (n < 100000) return helper(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + helper(n % 1000) : "");
    if (n < 10000000) return helper(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + helper(n % 100000) : "");
    return helper(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + helper(n % 10000000) : "");
  };

  const words = helper(absNum);
  return (num < 0 ? "Minus " : "") + words;
};

export const formatShareDate = (dateStr: string): string => {
  try {
    if (!dateStr) return "";
    
    // If it already has day name (e.g. "Fri", "Friday") or "am"/"pm", it's already formatted
    if (/[a-zA-Z]{3,}/.test(dateStr) && (dateStr.includes("/") || dateStr.includes("-"))) {
      return dateStr;
    }
    
    // Check if it's already a formatted Indian local date (like "19/6/2026, 01:31 pm")
    if (dateStr.toLowerCase().includes("am") || dateStr.toLowerCase().includes("pm")) {
      return dateStr;
    }

    let parseStr = dateStr;
    const hasTimezone = dateStr.endsWith("Z") || dateStr.includes("+") || dateStr.includes("GMT");
    
    if (!hasTimezone) {
      parseStr = dateStr.replace(" ", "T");
      if (!parseStr.includes("T")) {
        parseStr = parseStr + "T00:00:00Z";
      } else {
        parseStr = parseStr + "Z";
      }
    }
    
    const d = new Date(parseStr);
    if (isNaN(d.getTime())) return dateStr;

    // Use Intl to format explicitly to Asia/Kolkata (IST)
    const options: Intl.DateTimeFormatOptions = {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    };
    
    const formatted = d.toLocaleString("en-IN", options);
    
    const formatterDay = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" });
    const dayName = formatterDay.format(d);
    
    return `${formatted} ${dayName}`;
  } catch {
    return dateStr;
  }
};

// Share a Cash In (collection) entry
export const shareCollectionEntry = async (entry: {
  retailer_name?: string;
  retailerName?: string;
  bank_account_name?: string;
  bankAccountName?: string;
  portal_name?: string;
  portalName?: string;
  store_name?: string;
  storeName?: string;
  total_amount?: number;
  totalAmount?: number;
  amount?: number;
  denominations?: Record<string, number>;
  created_at?: string;
  createdAt?: string;
  date?: string;
  remarks?: string;
  retailer_ledger_token?: string;
  retailerLedgerToken?: string;
}, staffName: string) => {
  const retailer_name = entry.retailer_name || entry.retailerName;
  const bank_account_name = entry.bank_account_name || entry.bankAccountName;
  const store_name = entry.store_name || entry.storeName;
  const total_amount = entry.total_amount ?? entry.totalAmount ?? entry.amount ?? 0;
  const created_at = entry.created_at || entry.createdAt || entry.date;
  const remarks = entry.remarks;
  const retailer_ledger_token = entry.retailer_ledger_token || entry.retailerLedgerToken;

  const den = entry.denominations || {};

  const notes = [
    { value: 500, count: Number(den.note_500 || 0) },
    { value: 200, count: Number(den.note_200 || 0) },
    { value: 100, count: Number(den.note_100 || 0) },
    { value: 50, count: Number(den.note_50 || 0) },
    { value: 20, count: Number(den.note_20 || 0) },
    { value: 10, count: Number(den.note_10 || 0) },
  ];

  const lines: string[] = [];
  let totalNotesCount = 0;
  notes.forEach(note => {
    if (note.count !== 0) {
      lines.push(`${note.value} × ${note.count} = ${(note.value * note.count).toLocaleString("en-IN")}`);
      totalNotesCount += note.count;
    }
  });
  if (Number(den.coins || 0) !== 0) {
    lines.push(`Coins = ${Number(den.coins).toLocaleString("en-IN")}`);
  }
  if (Number(den.online_amount || 0) !== 0) {
    lines.push(`UPI/Online = ${Number(den.online_amount).toLocaleString("en-IN")}`);
  }

  const totalWords = numberToWordsIndian(total_amount);
  const dateFormatted = created_at ? formatShareDate(created_at) : "";

  const headerLines: string[] = [];
  if (retailer_name) {
    if (retailer_name.startsWith("Staff:")) {
      headerLines.push(retailer_name);
    } else if (retailer_name === "Office" || retailer_name === "Unknown Source") {
      headerLines.push(retailer_name);
    } else {
      headerLines.push(`Retailer: ${retailer_name}`);
    }
  }
  if (store_name) {
    headerLines.push(`Store: ${store_name}`);
  }
  const portal_name = entry.portal_name || entry.portalName;
  if (portal_name && portal_name !== "Cash" && portal_name !== "N/A") {
    headerLines.push(`Portal: ${portal_name}`);
  }
  if (remarks) {
    headerLines.push(`Remark: ${remarks}`);
  }
  const headerText = headerLines.length > 0 ? `${headerLines.join("\n")}\n` : "";

  const ledgerUrl = retailer_ledger_token
    ? `\n\nLedger: ${typeof window !== "undefined" ? window.location.origin : ""}/public/ledger/${retailer_ledger_token}`
    : "";

  const text = `${headerText}${lines.join("\n")}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄
Total : *₹ ${total_amount.toLocaleString("en-IN")}*  (Note: ${totalNotesCount})

${totalWords}${ledgerUrl}

${staffName}
${dateFormatted}`;

  await _doShare("Collection Receipt", text);
};

export const shareDepositEntry = async (entry: {
  deposit_type?: string;
  depositType?: string;
  target_name?: string;
  targetName?: string;
  portal_name?: string;
  portalName?: string;
  staff_name?: string;
  staffName?: string;
  amount?: number;
  denominations?: Record<string, number>;
  created_at?: string;
  createdAt?: string;
  date?: string;
  remarks?: string;
  recipient_staff_id?: string;
  recipientStaffId?: string;
  retailer_ledger_token?: string;
  retailerLedgerToken?: string;
  bank_account_name?: string;
  bankAccountName?: string;
}, staffName: string, currentUserId?: string) => {
  const deposit_type = entry.deposit_type || entry.depositType;
  const target_name = entry.target_name || entry.targetName;
  const portal_name = entry.portal_name || entry.portalName;
  const staff_name_val = entry.staff_name || entry.staffName;
  const amount = entry.amount ?? 0;
  const created_at = entry.created_at || entry.createdAt || entry.date;
  const remarks = entry.remarks;
  const recipient_staff_id = entry.recipient_staff_id || entry.recipientStaffId;
  const retailer_ledger_token = entry.retailer_ledger_token || entry.retailerLedgerToken;

  const den = entry.denominations || {};
  const isRecipient = recipient_staff_id === currentUserId && deposit_type === "staff";
  const mult = isRecipient ? 1 : -1;

  const notes = [
    { value: 500, count: Number(den.note_500 || 0) * mult },
    { value: 200, count: Number(den.note_200 || 0) * mult },
    { value: 100, count: Number(den.note_100 || 0) * mult },
    { value: 50, count: Number(den.note_50 || 0) * mult },
    { value: 20, count: Number(den.note_20 || 0) * mult },
    { value: 10, count: Number(den.note_10 || 0) * mult },
  ];

  const lines: string[] = [];
  let totalNotesCount = 0;
  notes.forEach(note => {
    if (note.count !== 0) {
      lines.push(`${note.value} × ${note.count} = ${(note.value * note.count).toLocaleString("en-IN")}`);
      totalNotesCount += Math.abs(note.count);
    }
  });
  if (Number(den.coins || 0) !== 0) {
    lines.push(`Coins = ${(Number(den.coins) * mult).toLocaleString("en-IN")}`);
  }
  if (Number(den.online_amount || 0) !== 0) {
    lines.push(`UPI/Online = ${(Number(den.online_amount) * mult).toLocaleString("en-IN")}`);
  }

  const totalVal = amount * mult;
  const totalWords = numberToWordsIndian(Math.abs(totalVal));

  const dateFormatted = created_at ? formatShareDate(created_at) : "";

  const headerLines: string[] = [];
  if (deposit_type === "staff") {
    headerLines.push(isRecipient ? `Received from: ${staff_name_val}` : `Staff Handover: ${target_name}`);
  } else if (deposit_type === "portal") {
    const bankAccountSuffix = entry.bank_account_name || entry.bankAccountName ? `  (${entry.bank_account_name || entry.bankAccountName})` : "";
    headerLines.push(`Store/Portal: ${portal_name || target_name}${bankAccountSuffix}`);
  } else if (deposit_type === "retailer") {
    headerLines.push(`Retailer Payout: ${target_name}`);
  } else if (deposit_type === "virtual") {
    headerLines.push("Virtual Transfer");
    if (target_name) headerLines.push(`Retailer: ${target_name}`);
    if (portal_name) headerLines.push(`Store: ${portal_name}`);
  }
  if (remarks) {
    headerLines.push(`Remark: ${remarks}`);
  }

  const headerText = headerLines.length > 0 ? `${headerLines.join("\n")}\n` : "";

  const ledgerUrl = retailer_ledger_token
    ? `\n\nLedger: ${typeof window !== "undefined" ? window.location.origin : ""}/public/ledger/${retailer_ledger_token}`
    : "";

  const text = `${headerText}${lines.join("\n")}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄
Total : *₹ ${Math.abs(totalVal).toLocaleString("en-IN")}*  (Note: ${totalNotesCount})

${totalWords}${ledgerUrl}

${staffName}
${dateFormatted}`;

  await _doShare("Deposit Slip", text);
};

async function _doShare(title: string, text: string) {
  if (typeof navigator === "undefined") return;
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
    } catch { /* user cancelled */ }
  } else {
    try {
      await navigator.clipboard.writeText(text);
      alert("Receipt details copied to clipboard!");
    } catch {
      alert("Could not copy to clipboard.");
    }
  }
}
