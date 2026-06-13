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
    const d = new Date(dateStr.replace(" ", "T"));
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    const hoursStr = hours.toString().padStart(2, "0");
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = days[d.getDay()];
    return `${day}/${month}/${year} ${hoursStr}:${minutes} ${ampm} ${dayName}`;
  } catch {
    return dateStr;
  }
};

// Share a Cash In (collection) entry
export const shareCollectionEntry = async (entry: {
  retailer_name?: string;
  portal_name?: string;
  store_name?: string;
  total_amount?: number;
  denominations?: Record<string, number>;
  created_at?: string;
  remarks?: string;
}, staffName: string) => {
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
    if (note.count > 0) {
      lines.push(`${note.value} × ${note.count} = ${(note.value * note.count).toLocaleString("en-IN")}`);
      totalNotesCount += note.count;
    }
  });
  if (Number(den.coins || 0) > 0) {
    lines.push(`Coins = ${Number(den.coins).toLocaleString("en-IN")}`);
  }
  if (Number(den.online_amount || 0) > 0) {
    lines.push(`UPI/Online = ${Number(den.online_amount).toLocaleString("en-IN")}`);
  }

  const totalVal = Number(entry.total_amount || 0);
  const totalWords = numberToWordsIndian(totalVal);

  let rawDate = entry.created_at || "";
  if (rawDate && !rawDate.endsWith("Z") && !rawDate.includes("+") && !rawDate.includes("GMT")) {
    rawDate = rawDate + "Z";
  }
  const dateFormatted = rawDate ? formatShareDate(new Date(rawDate).toLocaleString("sv-SE").substring(0, 19)) : "";

  const headerLines: string[] = [];
  if (entry.retailer_name) {
    if (entry.retailer_name.startsWith("Staff:")) {
      headerLines.push(entry.retailer_name);
    } else if (entry.retailer_name === "Office" || entry.retailer_name === "Unknown Source") {
      headerLines.push(entry.retailer_name);
    } else {
      headerLines.push(`Retailer: ${entry.retailer_name}`);
    }
  }
  if (entry.portal_name && entry.portal_name !== "Cash" && entry.portal_name !== "N/A") {
    headerLines.push(`Store: ${entry.portal_name}`);
  }
  const headerText = headerLines.length > 0 ? `${headerLines.join("\n")}\n` : "";
  const text = `${headerText}${lines.join("\n")}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄
Total : *₹ ${totalVal.toLocaleString("en-IN")}*  (Note: ${totalNotesCount})

${totalWords}

${staffName}
${dateFormatted}`;

  await _doShare("Collection Receipt", text);
};

// Share a Cash Out (deposit) entry
export const shareDepositEntry = async (entry: {
  deposit_type?: string;
  target_name?: string;
  portal_group_name?: string;
  staff_name?: string;
  amount?: number;
  denominations?: Record<string, number>;
  created_at?: string;
  remarks?: string;
  recipient_staff_id?: string;
}, staffName: string, currentUserId?: string) => {
  const den = entry.denominations || {};
  const isRecipient = entry.recipient_staff_id === currentUserId && entry.deposit_type === "staff";
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

  const totalVal = Number(entry.amount || 0) * mult;
  const totalWords = numberToWordsIndian(Math.abs(totalVal));

  let rawDate = entry.created_at || "";
  if (rawDate && !rawDate.endsWith("Z") && !rawDate.includes("+") && !rawDate.includes("GMT")) {
    rawDate = rawDate + "Z";
  }
  const dateFormatted = rawDate ? formatShareDate(new Date(rawDate).toLocaleString("sv-SE").substring(0, 19)) : "";

  const headerLines: string[] = [];
  if (entry.deposit_type === "staff") {
    headerLines.push(isRecipient ? `Received from: ${entry.staff_name}` : `Staff Handover: ${entry.target_name}`);
  } else if (entry.deposit_type === "portal") {
    headerLines.push(`Store/Portal: ${entry.portal_group_name || entry.target_name}`);
  } else if (entry.deposit_type === "retailer") {
    headerLines.push(`Retailer Payout: ${entry.target_name}`);
  } else if (entry.deposit_type === "virtual") {
    headerLines.push("Virtual Transfer");
    if (entry.target_name) headerLines.push(`Retailer: ${entry.target_name}`);
    if (entry.portal_group_name) headerLines.push(`Store: ${entry.portal_group_name}`);
  }

  const headerText = headerLines.length > 0 ? `${headerLines.join("\n")}\n` : "";
  const text = `${headerText}${lines.join("\n")}
┄┄┄┄┄┄┄┄┄┄┄┄┄┄
Total : *₹ ${Math.abs(totalVal).toLocaleString("en-IN")}*  (Note: ${totalNotesCount})

${totalWords}

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
