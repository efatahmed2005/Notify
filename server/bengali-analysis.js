const BENGALI = /[\u0980-\u09ff]/gu;
const DIGIT = "[০-৯0-9]";
const MONTHS = "জানুয়ারি|জানুয়ারী|ফেব্রুয়ারি|ফেব্রুয়ারী|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর";
const DATE = new RegExp(`(${DIGIT}{1,2})(?:ই|শে|রা|ঠা|তম)?\\s*(${MONTHS})\\s*(${DIGIT}{4})(?:\\s*খ্রি\\.?)?`, "gu");
const NUMERIC_DATE = /([০-৯0-9]{1,2})[/-]([০-৯0-9]{1,2})[/-]([০-৯0-9]{4})/gu;
const MONTH_NAMES = ["", "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
const TITLE_WORDS = [
  "জাতীয়", "জাতীয়", "বিপ্লব", "ও", "সংহতি", "দিবস", "বিশ্ববিদ্যালয়", "বিশ্ববিদ্যালয়",
  "বন্ধ", "পরীক্ষা", "পরীক্ষার", "রুটিন", "ভর্তি", "মেলা", "ফেয়ার", "ফেয়ার",
  "কর্মসূচি", "উদযাপন", "শিক্ষার্থী", "শিক্ষার্থীদের", "বিভাগ", "বিভাগের",
  "আবেদন", "নিয়োগ", "নিয়োগ", "ফলাফল", "প্রকাশ", "সেমিস্টার", "তালিকা",
  "সেমিনার", "অ্যাডমিশন", "স্প্রিং", "রচনা", "প্রতিযোগিতা", "আলোচনা", "সভা",
].sort((a, b) => b.length - a.length);
const GENERIC = /^(?:বিজ্ঞপ্তি|নোটিশ|অফিস আদেশ|প্রজ্ঞাপন|সার্কুলার|জরুরি বিজ্ঞপ্তি)$/u;
const COPY = /(?:অনুলিপি|অনুলিপিপ্রেরণ|সদয়অবগতি|সদয়অবগতি|কর্তৃপক্ষের নির্দেশক্রমে|কর্তৃপক্ষেরনির্দেশক্রমে)/u;
const ACTION = /(?:অনুষ্ঠিত|অনুষ্ঠান|আয়োজন|আয়োজন|শুরু|শেষ|বন্ধ|খোলা|স্থগিত|প্রকাশ|আবেদন|জমা|পরীক্ষা|ভর্তি|নিবন্ধন|নিয়োগ|নিয়োগ|নির্ধারিত|হবে|করতে হবে|করার জন্য)/u;

function bengaliDigits(value) {
  return String(value).replace(/[0-9]/g, (digit) => "০১২৩৪৫৬৭৮৯"[Number(digit)]);
}

function asciiDigits(value) {
  return String(value).replace(/[০-৯]/g, (digit) => String("০১২৩৪৫৬৭৮৯".indexOf(digit)));
}

function bengaliDay(value) {
  return bengaliDigits(Number(asciiDigits(value)));
}

function tidy(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\s+/gu, " ")
    .replace(/([।!?])(?=[\p{L}])/gu, "$1 ")
    .replace(/([০-৯0-9]%)(?=[\p{L}])/gu, "$1 ")
    .replace(/(?<=[\p{L}])([০-৯0-9]{1,2})(?=(?:ই|শে|রা|ঠা|তম)?(?:জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর))/gu, " $1")
    .trim();
}

function spaceKnownWords(value) {
  return value.replace(/[\u0980-\u09ff]{8,}/gu, (token) => {
    const memo = new Map();
    const divide = (position) => {
      if (position === token.length) return [];
      if (memo.has(position)) return memo.get(position);
      let best = null;
      for (const word of TITLE_WORDS) {
        if (!token.startsWith(word, position)) continue;
        const rest = divide(position + word.length);
        if (rest && (!best || rest.length + 1 < best.length)) best = [word, ...rest];
      }
      memo.set(position, best);
      return best;
    };
    const parts = divide(0);
    return parts && parts.length > 1 ? parts.join(" ") : token;
  });
}

function cleanSubject(value) {
  return spaceKnownWords(tidy(value)
    .replace(/^খ্?যাডমিশন/u, "অ্যাডমিশন")
    .replace(/^এ্যাডমিশন/u, "অ্যাডমিশন")
    .replace(/ফেয়ার\s*স্প্?িং/u, "ফেয়ার স্প্রিং")
    .replace(/ফেয়ার\s*স্প্?িং/u, "ফেয়ার স্প্রিং")
    .replace(/^[‘'"\s]+|[’'"\s]+$/gu, "")
    .replace(/[।,;:]+$/u, "")
    .trim());
}

function bodyLines(source) {
  const lines = String(source || "").normalize("NFKC").split(/\r?\n/u).map(tidy);
  let heading = "";
  let start = lines.findIndex((line) => GENERIC.test(line));
  if (start < 0) {
    start = lines.findIndex((line) => /[\u0980-\u09ff]/u.test(line) &&
      !/^(?:রেফ|তারিখ|Date|Ref)\s*[:：]/iu.test(line) &&
      !line.includes("/") && line.length > 15);
    if (start < 0) return { heading, body: "" };
    if (lines[start].length < 100 && !ACTION.test(lines[start])) {
      heading = lines[start];
      start++;
    }
  } else if (start > 0 && /(?:বিষয়|বিষয়|সংক্রান্ত)/u.test(lines[start - 1])) {
    heading = lines[start - 1];
  }
  const kept = [];
  for (const line of lines.slice(start + (GENERIC.test(lines[start]) ? 1 : 0))) {
    if (COPY.test(line) || /^রেজিস্ট্রার\s*$/u.test(line) || /^স্বাক্ষর\s*$/u.test(line)) break;
    if (/^(?:তারিখ|Date|Ref|রেফ)\s*[:：]/iu.test(line) ||
        /(?:\/){2,}/u.test(line)) continue;
    if (/[\u0980-\u09ff]/u.test(line) || (kept.length && /[০-৯0-9]{1,2}%/u.test(line)))
      kept.push(line);
  }
  return { heading, body: tidy(kept.join(" ")) };
}

function datedFacts(body) {
  const written = [...body.matchAll(DATE)].map((match) => {
    const day = Number(asciiDigits(match[1]));
    if (day < 1 || day > 31) return null;
    return {
      text: `${bengaliDay(match[1])} ${match[2]} ${bengaliDigits(match[3])}`,
      index: match.index,
      end: match.index + match[0].length,
    };
  }).filter(Boolean);
  const numeric = [...body.matchAll(NUMERIC_DATE)].map((match) => {
    const month = MONTH_NAMES[Number(asciiDigits(match[2]))];
    const day = Number(asciiDigits(match[1]));
    if (!month || day < 1 || day > 31) return null;
    return {
      text: `${bengaliDay(match[1])} ${month} ${bengaliDigits(match[3])}`,
      index: match.index,
      end: match.index + match[0].length,
    };
  }).filter(Boolean);
  const matches = [...written, ...numeric].sort((a, b) => a.index - b.index)
    .filter((date) => {
      const before = body.slice(Math.max(0, date.index - 24), date.index);
      const after = body.slice(date.end, date.end + 115);
      return !(/গত\s*$/u.test(before) &&
        /তারিখের[\s\S]{0,90}(?:স্মারক|স্যারক|প্রজ্ঞাপন|গ্রজ্ঞাপন|পত্র|নম্বর|লন্বর)/u.test(after));
    });
  if (!matches.length) return null;
  const first = matches[0];
  const second = matches[1];
  const connector = second ? body.slice(first.end, second.index) : "";
  const rangeWords = connector.replace(/[\s,，।;:.]/gu, "").replace(/খ্রি|তারিখ/gu, "");
  const dateRange = connector.length <= 40 &&
    /^(?:থেকে|হতে|পর্যন্ত|অবধি|–|-)+$/u.test(rangeWords);
  if (second && dateRange &&
      first.text.split(" ")[1] === second.text.split(" ")[1] &&
      first.text.split(" ")[2] === second.text.split(" ")[2]) {
    return { text: `${first.text.split(" ")[0]}–${second.text}`, range: true, following: matches.slice(2) };
  }
  if (second && dateRange)
    return { text: `${first.text} থেকে ${second.text}`, range: true, following: matches.slice(2) };
  const dayOnly = body.slice(Math.max(0, first.index - 35), first.index)
    .match(/([০-৯0-9]{1,2})\s*(?:থেকে|হতে|–|-)\s*$/u);
  if (dayOnly)
    return { text: `${bengaliDay(dayOnly[1])}–${first.text}`, range: true, following: matches.slice(1) };
  return { text: first.text, range: false, following: matches.slice(1) };
}

function submissionFact(body, dates) {
  for (const date of dates?.following || []) {
    const nearby = body.slice(Math.max(0, date.index - 200), date.end + 115);
    if (/(?:রচনা|আবেদন|ফরম|ফর্ম|প্রতিবেদন)/u.test(nearby) &&
        /(?:জমা|জামা)/u.test(nearby) && /(?:মধ্যে|শেষ|অবধি)/u.test(nearby))
      return `${/রচনা/u.test(nearby) ? "রচনা" : /আবেদন/u.test(nearby) ? "আবেদন" : "নথি"} জমা: ${date.text}`;
  }
  return "";
}

function subjectFrom(body, heading) {
  if (heading && !GENERIC.test(heading)) return cleanSubject(heading.replace(/^বিষ(?:য়|য়)\s*[:：]\s*/u, ""));
  const quoted = [...body.matchAll(/[‘'“"]([^’'”"\n]{4,110})[’'”"]/gu)]
    .map((match) => cleanSubject(match[1]))
    .find((candidate) => /[\u0980-\u09ff]/u.test(candidate) &&
      !/^(?:নর্থ|উত্তর|বিশ্ববিদ্যালয়)/u.test(candidate));
  if (quoted) return quoted;
  const core = body
    .replace(/^.{0,180}?(?:জানানো\s*যাচ্ছে\s*যে|জানানোযাচ্ছেযে|অবগতির\s*জন্য|অবগতিরজন্য)/u, "")
    .replace(/^(?:[,，]\s*|যে\s*)/u, "");
  const beforeDate = core.split(/আগামী|[০-৯0-9]{1,2}[/-][০-৯0-9]{1,2}[/-][০-৯0-9]{4}|[০-৯0-9]{1,2}(?:ই|শে|রা|ঠা|তম)?\s*(?:জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর)/u)[0];
  let candidate = cleanSubject(beforeDate.length >= 5 && beforeDate.length <= 95
    ? beforeDate.split("।")[0] : core.split("।")[0].slice(0, 90));
  if (candidate.length < 40 && /(?:বন্ধ\s*থাকবে|বন্ধথাকবে)/u.test(core) &&
      !/বন্ধ/u.test(candidate)) candidate += " বন্ধ";
  return candidate.replace(/(?:প্রকাশ\s*করা\s*হয়েছে|প্রকাশকরাহয়েছে|অনুষ্ঠিত\s*হবে|অনুষ্ঠিতহবে|হবে)\s*$/u, "").trim();
}

function discountFacts(body) {
  const facts = [];
  const percentages = [...body.matchAll(/([০-৯0-9]{1,3})\s*%/gu)];
  for (const match of percentages.slice(0, 3)) {
    const before = body.slice(Math.max(0, match.index - 85), match.index);
    const after = body.slice(match.index + match[0].length, match.index + match[0].length + 60);
    const percent = `${bengaliDigits(match[1])}%`;
    const merit = Math.max(before.lastIndexOf("মেধারভিত্তিতে"), before.lastIndexOf("মেধার ভিত্তিতে"));
    const tuition = Math.max(before.lastIndexOf("টিউশন"), before.lastIndexOf("অতিরিক্ত"));
    if (merit >= 0 && merit > tuition)
      facts.push(`মেধার ভিত্তিতে ${percent} পর্যন্ত ছাড়ের সুযোগ`);
    else if (tuition >= 0 ||
        /টিউশন\s*ফি|টিউশনফি|অতিরিক্ত/u.test(after))
      facts.push(`টিউশন ফিতে অতিরিক্ত ${percent} ছাড়`);
    else if (/ছাড়|সুবিধা/u.test(after)) facts.push(`${percent} ছাড়ের সুযোগ`);
  }
  return [...new Set(facts)];
}

export function isBengaliNotice(source) {
  const value = String(source || "");
  const bengali = (value.match(BENGALI) || []).length;
  const latin = (value.match(/[A-Za-z]/g) || []).length;
  return bengali >= 25 && (bengali >= latin * 0.5 ||
    /(?:^|\n)\s*(?:বিজ্ঞপ্তি|নোটিশ|অফিস আদেশ)\s*(?:\n|$)/u.test(value));
}

export function analyzeBengaliNotice(source) {
  const { heading, body } = bodyLines(source);
  const subject = subjectFrom(body, heading);
  const date = datedFacts(body);
  const discounts = discountFacts(body);
  const hasEvent = /(?:অনুষ্ঠিত|আয়োজন|আয়োজন)/u.test(body);
  const hasProgram = /(?:উদযাপন|কর্মসূচি)/u.test(body);
  const hasClosure = /(?:বন্ধ\s*থাকবে|বন্ধথাকবে)/u.test(body);
  const meaningfulSubject = subject.length >= 5 && subject.length <= 100 &&
    !/^(?:বিজ্ঞপ্তি|নোটিশ|তারিখ|নর্থওয়েস্টার্ন)/u.test(subject);
  const title = meaningfulSubject
    ? `${subject}${date ? `: ${date.text}` : ""}`.slice(0, 145)
    : "";
  const lead = hasProgram ? `${subject} উপলক্ষে ${date ? `${date.text} ` : ""}কর্মসূচি গ্রহণ করা হয়েছে` :
    hasEvent ? `${subject} ${date ? `${date.text} ` : ""}অনুষ্ঠিত হবে` :
    hasClosure ? `${subject.replace(/\s*বন্ধ(?:\s*থাকবে)?$/u, "")} ${date ? `${date.text} ` : ""}বন্ধ থাকবে` :
    `${subject}${date ? `: ${date.text}` : ""}`;
  const details = [
    hasProgram && /আলোচনা\s*সভা/u.test(body) && "আলোচনা সভার কর্মসূচি রয়েছে",
    submissionFact(body, date),
  ].filter(Boolean);
  const summary = meaningfulSubject
    ? [lead, ...details, ...discounts].filter(Boolean).join("। ").replace(/।?$/u, "।")
    : "";
  const category = /(?:পরীক্ষা|রুটিন|প্রবেশপত্র|ফলাফল)/u.test(body) ? "EXAM" :
    /(?:বন্ধ\s*থাকবে|বন্ধথাকবে|ছুটি)/u.test(body) ? "ANNOUNCEMENT" :
    /(?:অনুষ্ঠিত|আয়োজন|আয়োজন|উদযাপন|কর্মসূচি|মেলা|ফেয়ার|ফেয়ার)/u.test(body) ? "EVENT" :
    "ANNOUNCEMENT";
  return {
    title,
    summary,
    keywords: [subject, date?.text, ...details, ...discounts].filter(Boolean),
    category,
    needsReview: !meaningfulSubject || !date || /(?:খ্যা|স্প্িং|\bwere\b)/u.test(subject),
    warning: "প্রকাশের আগে মূল নথির সঙ্গে শিরোনাম, তারিখ ও সারাংশ মিলিয়ে দেখুন।",
  };
}
