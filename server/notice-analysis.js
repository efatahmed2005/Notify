const EVENT_PATTERNS = [
  {
    category: "EXAM",
    pattern:
      /\b(?:exams?|examinations?|tests?|viva|routine|timetable|thesis defense)\b/i,
  },
  {
    category: "ANNOUNCEMENT",
    pattern: /\b(?:closed|closure|holiday|reopen|suspend(?:ed)?|postponed)\b/i,
  },
  {
    category: "EVENT",
    pattern: /\b(?:seminar|workshop|orientation|ceremony|meeting|event)\b/i,
  },
];
const DATE =
  /\b(?:\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{1,2}(?:st|nd|rd|th)?)?(?:,?\s+\d{4})?\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi;
const TIME =
  /\b\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b|\b\d{1,2}:\d{2}\b/i;
const ACTION =
  /\b(?:will|must|shall|should|may|announces?|required|requested|advised|invited|scheduled|held|starts?|begins?|ends?|closes?|opens?|available|published|submit|complete|pay|attend|appear|contact|resume|postponed|cancelled|conducted|take place|permitted|apply|register|assigned|appointed|released|transferred|approved|effective|consented|serve|serving)\b/i;
const GENERIC_HEADING =
  /^(?:(?:notice|circular|memo|announcement|office order)(?:\s*\([^)]*\))?)$/i;
const REFERENCE =
  /(?:^\s*(?:ref(?:erence)?|memo\s*no\.?)\s*[:#]|\b[A-Z]{2,8}\/[\w./& -]*\/(?:notice|natice)\/|\b[A-Z]{2,8}\/[\w./& -]*\/20\d{2}\/)/i;
const FOOTER =
  /^(?:cc\s*:|copy (?:forwarded|sent|for|to)\b|distribution list\b|by order\b|(?:registrar|controller of examinations|exam controller),?\s*(?:NWU|North Western University)?\.?$)/i;
const STOP = new Set(
  "a an and are as at be before by for from in into is it of on or our regarding the their this to university will with notice department students student all".split(
    " ",
  ),
);

function words(value) {
  return (value.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(
    (word) => word.length > 2 && !STOP.has(word),
  );
}

function clean(value) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\bof(?=[A-Z][a-z])/g, "of ")
    .replace(/\bItis\b/g, "It is")
    .replace(/\bofclasses\b/gi, "of classes")
    .replace(
      /(\d)(?=(?:January|February|March|April|May|June|July|August|September|October|November|December)\b)/gi,
      "$1 ",
    )
    .replace(/([\p{L}])-\s+(?=[\p{L}])/gu, "$1-")
    .replace(/(\d{4})\?\s+(?=(?:semester|intake|students?)\b)/gi, "$1 ")
    .replace(
      /\b(closed)\s+form\s+(?=\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/gi,
      "$1 from ",
    );
}

function splitSentences(value) {
  return value
    .replace(/\b(?:Dr|Mr|Mrs|Ms|Prof|No|Dept)\./gi, (match) =>
      match.replace(".", "\uE000"),
    )
    .replace(/\b[A-Z]\.(?=\s+[A-Z])/g, (match) => match.replace(".", "\uE000"))
    .split(/(?<=[.!])\s+(?=[\p{Lu}][\p{Ll}]{1,})/u)
    .map((part) => part.replace(/\uE000/g, "."));
}

function splitLong(value, limit = 700) {
  const pieces = [];
  let remaining = value;
  while (remaining.length > limit) {
    const cut = Math.max(remaining.lastIndexOf(" ", limit), 1);
    pieces.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function withoutPreamble(value) {
  return clean(value)
    .replace(/^[\\|]+(?=[A-Za-z])/, "")
    .replace(
      /^(?:(?:it|tt|lt|ii)\s+is\s+(?:hereby\s+)?(?:notified|informed)\b[\s\S]*?\bthat|this is to inform\b[\s\S]*?\bthat|please be informed that|.{1,90}?\s+are\s+(?:hereby\s+)?(?:informed|notified)\s+that)\s+/i,
      "",
    );
}

function segments(source) {
  const lines = String(source || "")
    .normalize("NFKC")
    .replace(/\u0000/g, " ")
    .split(/\r?\n/u)
    .map(clean);
  const chunks = [];
  let pending = "";
  let heading = "";
  let headingContinues = false;
  let inSchedule = false;
  let skipHeaderDate = false;
  const schedule = [];
  const flush = () => {
    if (pending) chunks.push(pending);
    pending = "";
  };
  for (const [index, line] of lines.entries()) {
    if (!line) {
      flush();
      continue;
    }
    if (skipHeaderDate) {
      skipHeaderDate = false;
      if (line.match(DATE) && line.length < 40) continue;
    }
    if (/^date\s*[:#]\s*$/i.test(line) && !heading && index < 25) {
      skipHeaderDate = true;
      continue;
    }
    if (GENERIC_HEADING.test(line)) {
      pending = "";
      chunks.length = 0;
      heading = line;
      continue;
    }
    if (FOOTER.test(line)) break;
    if (REFERENCE.test(line) || /^\s*:\s*[A-Z]{2,8}\//i.test(line)) {
      flush();
      continue;
    }
    if (
      /^(?:ref(?:erence)?|memo(?:randum)?\s*no\.?|phone|tel|cell|e-?mail|website|address)\s*[:#]/i.test(
        line,
      ) ||
      (/^date\s*[:#]/i.test(line) && !heading && index < 20) ||
      /^(?:www\.|https?:\/\/)/i.test(line) ||
      (/\b(?:phone|pabx|fax|cell|e-?mail|web)\s*:/i.test(line) && index < 10)
    ) {
      flush();
      continue;
    }
    if (inSchedule) {
      if (
        line.length < 95 &&
        !/^(?:we|all|students|faculty|the|this|please|without|if|those)\s/i.test(
          line,
        ) &&
        !(ACTION.test(line) && /[.!?]$/.test(line))
      ) {
        schedule.push(line);
        continue;
      }
      inSchedule = false;
    }
    if (headingContinues) {
      headingContinues = false;
      if (
        line.length <= 100 &&
        words(line).length >= 1 &&
        words(line).length <= 10 &&
        !ACTION.test(line) &&
        !/[.!?]$/.test(line)
      ) {
        heading = `${heading} ${line}`;
        continue;
      }
    }
    if (
      /^(?:notice|circular|announcement)\s+(?:regarding|for|on|about)\s*:?$/i.test(
        line,
      )
    ) {
      pending = "";
      chunks.length = 0;
      heading = line;
      headingContinues = true;
      continue;
    }
    if (
      !heading &&
      line.length <= 120 &&
      words(line).length >= 1 &&
      words(line).length <= 12 &&
      /\b(?:notice|circular|memo|subject|regarding|announcement)\b/i.test(
        line,
      ) &&
      !/[.!?]$/.test(line)
    ) {
      pending = "";
      chunks.length = 0;
      heading = line;
      continue;
    }
    if (
      (index < 8 &&
        /\buniversity\b/i.test(line) &&
        words(line).length < 5 &&
        !ACTION.test(line)) ||
      (/^department\s+of\b/i.test(line) &&
        words(line).length < 10 &&
        !ACTION.test(line))
    ) {
      flush();
      continue;
    }
    pending = pending ? `${pending} ${line}` : line;
    if (
      /\b(?:following|below)\s+(?:schedule|table|details)\s*[:.]?\s*$/i.test(
        line,
      )
    ) {
      flush();
      inSchedule = true;
      continue;
    }
    if (/^(?:departments?\s*:\s*-?|person\s*&\s*event)\s*$/i.test(line)) {
      flush();
      inSchedule = true;
      continue;
    }
    if (
      /[.!?]$/.test(line) &&
      !/\b(?:B\.Sc|M\.Sc|Dr|Prof|No|Dept)\.$/i.test(line)
    )
      flush();
  }
  flush();
  return {
    heading,
    schedule,
    sentences: chunks
      .flatMap(splitSentences)
      .map(clean)
      .flatMap((part) => splitLong(part))
      .filter(
        (part) =>
          words(part).length >= 3 &&
          !REFERENCE.test(part) &&
          !FOOTER.test(part),
      ),
  };
}

function score(sentence, position, topic) {
  const tokens = words(sentence);
  const topicHits = new Set(tokens.filter((word) => topic.has(word))).size;
  const dates = (sentence.match(DATE) || []).length;
  return (
    Math.min(tokens.length, 24) / 5 +
    (ACTION.test(sentence) ? 4 : 0) +
    Math.min(dates, 2) * 5 +
    (TIME.test(sentence) ? 2 : 0) +
    Math.min(topicHits, 3) * 2 +
    (dates &&
    /\b(?:deadline|due|last date|on or before|no later than)\b/i.test(sentence)
      ? 2
      : 0) -
    Math.min(position, 20) * 0.18 -
    (/^(?:by order|registrar|head|dean|signed|sincerely|thank you)\b/i.test(
      sentence,
    )
      ? 10
      : 0)
  );
}

function distinct(candidate, selected) {
  const set = new Set(words(candidate.part));
  return selected.every((item) => {
    const other = new Set(words(item.part));
    const common = [...set].filter((word) => other.has(word)).length;
    return common / Math.max(1, Math.min(set.size, other.size)) < 0.7;
  });
}

function shorten(value, limit) {
  const phrase = clean(value).replace(/[.!?]+$/g, "");
  if (phrase.length <= limit) return phrase;
  const cut = phrase.slice(0, limit + 1);
  return cut
    .slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : limit)
    .trim();
}

function shortenTitle(value) {
  const full = clean(value).replace(/[.!?]+$/g, "");
  const clipped = shorten(full, 120);
  const detail = dateDetail(full);
  const date = detail?.value;
  if (!date || clipped.includes(date))
    return clipped
      .replace(
        /\b(?:on the occasion of|on the|according to|for the|on|for|of|to|from|with|and|or|by|the|a)\s*$/i,
        "",
      )
      .replace(/[,;:]\s*$/, "")
      .trim();
  const suffix = `${detail.relation}${date}`;
  const prefix = shorten(
    full
      .slice(0, full.indexOf(date))
      .replace(/\s*(?:on|by|from|before|until|effective)\s*$/i, ""),
    120 - suffix.length - 2,
  );
  return `${prefix}…${suffix}`;
}

function summarySentence(value) {
  let sentence = withoutPreamble(value)
    .replace(/(?<=\w)’(?=\w)/g, "'")
    .replace(/[‘’“”]/g, "")
    .replace(/\"/g, "")
    .replace(/\baccording to the following schedule\s*:?$/i, "")
    .replace(/\baccording to the following (?:table|details)\s*:?$/i, "")
    .trim();
  if (sentence && /[\p{Ll}]/u.test(sentence[0]))
    sentence = sentence[0].toLocaleUpperCase() + sentence.slice(1);
  if (sentence && !/[.!?]$/.test(sentence)) sentence += ".";
  if (sentence.length <= 480) return sentence;
  const cut = sentence.slice(0, 481);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trim()}...`;
}

function actionTitle(sentences) {
  const first = sentences.slice(0, 5).join(" ");
  const appointment = sentences.find((sentence) =>
    /\b(?:assigned|appointed|designated)\b/i.test(sentence),
  );
  if (appointment) {
    const person = appointment.match(
      /\b(?:Mr|Ms|Mrs|Dr)\.?\s+[A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+){1,3}/u,
    )?.[0];
    const role = appointment.match(
      /\b(?:Head|Dean|Chair|Director|Coordinator|Registrar|Controller)\s+of\s+(?:the\s+)?[\p{L} ]+?(?=\s+to\s+(?:Mr|Ms|Mrs|Dr)\.?\b|[,.;]|$)/iu,
    )?.[0];
    if (person && role) return `${person} assigned as ${role}`;
  }
  const subjects = [
    ...first.matchAll(
      /\b(?:apply for|register for|attend|participate in)\s+(?:the\s+)?([^,.]{1,90})/giu,
    ),
  ]
    .map(
      (match) =>
        match[1].match(/^[A-Z][\p{L}]+(?:\s+[A-Z][\p{L}]+){0,3}/u)?.[0],
    )
    .filter(Boolean)
    .filter(
      (value) =>
        !/^(?:Spring|Fall|Summer|North|Western|Department|Office)\b/i.test(
          value,
        ),
    );
  const unique = [...new Set(subjects)];
  if (unique.length) return unique.slice(0, 3).join(" and ");
  return "";
}

function topicPhrase(sentences) {
  for (const sentence of sentences.slice(0, 4)) {
    const quoted = [...sentence.matchAll(/[‘'“"]([^’'”"\n]{5,100})[’'”"]/g)]
      .map((match) => clean(match[1]))
      .filter((phrase) => words(phrase).length >= 2)
      .filter(
        (phrase) =>
          !/^(?:spring|fall|summer|autumn)\s*(?:&|and|,)?\s*(?:spring|fall|summer|autumn)?\s*\d{4}$/i.test(
            phrase,
          ),
      );
    if (quoted.length) return quoted[0];
  }
  return "";
}

function scheduleFacts(lines) {
  if (!lines.length) return null;
  const content = clean(lines.join(" "));
  const date = content.match(DATE)?.[0];
  const time = content.match(TIME)?.[0];
  const day = content.match(
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i,
  )?.[0];
  const venue = content
    .match(
      /\b(?:Auditorium|Hall|Room|Building|Campus|Office|Conference Centre|Conference Center)\b[\s\S]*/i,
    )?.[0]
    ?.replace(TIME, "")
    .replace(
      /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
      "",
    )
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    ?.replace(/\b(?:We are|All students|All faculty)\b[\s\S]*/i, "")
    .trim();
  if (!date && !time && !venue) return null;
  const when = [date, day, time].filter(Boolean).join(", ");
  const place = venue?.replace(/[.\s]+$/, "");
  return {
    date,
    time,
    place,
    text: [when && `Date and time: ${when}.`, place && `Venue: ${place}.`]
      .filter(Boolean)
      .join(" "),
  };
}

function tableDate(value) {
  const line = clean(value).replace(/[|\]]/g, " ");
  const list = line.match(
    /\b(?:\d{1,2}\s*(?:,|&|and)\s*){1,4}\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?/i,
  );
  if (list)
    return list[0].replace(/\s*&\s*/g, " and ").replace(/\s*,\s*/g, ", ");
  return line.match(DATE)?.[0] || "";
}

function tableTime(value) {
  const source = clean(value);
  const times = [...source.matchAll(new RegExp(TIME.source, "gi"))].map(
    (match) => match[0],
  );
  if (times.length > 1) return times.join("–");
  if (!times.length) return "";
  return /\b(?:till|until|by)\b/i.test(source)
    ? `until ${times[0]}`
    : /\bat\b/i.test(source)
      ? `at ${times[0]}`
      : times[0];
}

function tableFacts(lines) {
  if (!lines.length) return null;
  const entries = [];
  const departments = [];
  let label = "";
  let inPeople = false;
  const commit = () => {
    if (label) entries.push({ label, date: "", time: "" });
    label = "";
  };
  for (const original of lines) {
    const line = clean(original)
      .replace(/^\s*\d{1,2}(?:[.)]|\s*,\s*\|)\s*/, "")
      .replace(/^[\s|\[\]\/\\-]+/, "")
      .replace(/[|\[\]]/g, " ")
      .trim();
    if (
      /^(?:person\s*&\s*event|responsible person|place of issue|academic building)/i.test(
        line,
      )
    ) {
      inPeople = true;
      commit();
    }
    if (inPeople) continue;
    if (
      /^(?:date\s*&\s*time|day|venue|subject|sl\.?|departments?\s*:?)/i.test(
        line,
      )
    )
      continue;
    const department = line.match(/^([A-Z]{2,8})\s*[-:]\s*(.+)$/);
    if (department && tableDate(department[2])) {
      departments.push({ code: department[1], date: tableDate(department[2]) });
      continue;
    }
    const date = tableDate(line);
    const time = tableTime(line);
    if (date || time) {
      if (!label && entries.length && !entries.at(-1).date) {
        entries.at(-1).date = date || entries.at(-1).date;
        entries.at(-1).time = time || entries.at(-1).time;
      } else if (label) {
        entries.push({ label, date, time });
        label = "";
      } else if (entries.length && time && !date && !entries.at(-1).time) {
        entries.at(-1).time = time;
      }
      continue;
    }
    if (
      words(line).length >= 2 &&
      words(line).length <= 7 &&
      /\b(?:admission|distribution|receipt|eligible|published|publish|result|card|test|exam|application|registration|payment|deadline|orientation|class|session|meeting|seminar|workshop)\b/i.test(
        line,
      )
    ) {
      commit();
      label = line;
    }
  }
  commit();
  const datedEntries = entries.filter((entry) => entry.date);
  const firstDate = datedEntries[0]?.date || departments[0]?.date || "";
  const lastDate = datedEntries.at(-1)?.date || departments.at(-1)?.date || "";
  const first = firstDate.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const last = lastDate.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const dateRange =
    first &&
    last &&
    first[2].toLowerCase() === last[2].toLowerCase() &&
    first[3] === last[3] &&
    first[1] !== last[1]
      ? `${first[1]}–${last[1]} ${last[2]} ${last[3]}`
      : firstDate;
  const departmentDates =
    departments.length &&
    departments.every((item) => item.date === departments[0].date)
      ? `${departments.map((item) => item.code).join(", ")}: ${departments[0].date}`
      : departments.map((item) => `${item.code}: ${item.date}`).join(". ");
  const text = [
    ...entries
      .filter((entry) => entry.date || entry.time)
      .map((entry) => {
        const time = entry.time
          ? `${/^(?:until|at)\b/i.test(entry.time) ? " " : ", "}${entry.time}`
          : "";
        const label = (
          entry.label[0].toUpperCase() + entry.label.slice(1).toLowerCase()
        )
          .replace(/\s*&\s*/g, " and ")
          .replace(/^Result publish$/i, "Results published");
        return `${label}: ${entry.date}${time}.`;
      }),
    departmentDates && `Department dates: ${departmentDates}.`,
  ]
    .filter(Boolean)
    .join(" ");
  if (!text) return null;
  return {
    text,
    entries,
    departments,
    firstDate,
    dateRange,
    primaryDate: departments[0]?.date || firstDate,
    needsReview: entries.some((entry) => entry.time && !entry.date),
  };
}

function scheduleSubject(sentences) {
  const source = sentences.find((sentence) =>
    /\bfollowing schedule\b/i.test(sentence),
  );
  if (!source) return null;
  const core = withoutPreamble(source);
  const subject = core.match(
    /^(?:the\s+)?(.{3,65}?)\s+will be (?:conducted|held|organized|published)\s+according to the following schedule/i,
  )?.[1];
  if (!subject) return null;
  const department =
    source.match(
      /\bDepartment of [A-Za-z ]+?(?=\s+at\b|\s+that\b|[,.;])/i,
    )?.[0] || "";
  const term =
    source
      .match(/\b(?:Spring|Summer|Fall|Autumn)[ -]?20\d{2}\b/i)?.[0]
      ?.replace("-", " ") || "";
  const topic = subject.replace(/\s+process$/i, "").toLowerCase();
  const title = `${department ? `${department} ` : ""}${topic} schedule${term ? ` (${term})` : ""}`;
  return {
    title: title[0].toUpperCase() + title.slice(1),
    summary: `${department || "The university"} ${subject}${term ? ` for ${term}` : ""} follows this schedule.`,
  };
}

function dateDetail(value) {
  const matches = [...String(value || "").matchAll(DATE)];
  if (!matches.length) return null;
  const first = matches[0];
  const before = value.slice(0, first.index);
  const next = matches[1];
  const connector =
    next && value.slice(first.index + first[0].length, next.index);
  if (connector && /^\s*(?:to|through|until|and|[-–])\s*$/i.test(connector)) {
    return {
      value: value.slice(first.index, next.index + next[0].length),
      relation: /\bbetween\s*$/i.test(before) ? " between " : " from ",
    };
  }
  return {
    value: first[0],
    relation: /\b(?:by|before|until)\s*$/i.test(before)
      ? " by "
      : /\beffective(?:\s+(?:on|from))?\s*$/i.test(before)
        ? " effective "
        : " on ",
  };
}

function titleFrom(heading, lead, topic, sentences, schedule) {
  if (!heading || GENERIC_HEADING.test(heading)) {
    const action = actionTitle(sentences);
    let title = topic || action || withoutPreamble(lead);
    title = title
      .replace(/\bwill remain closed\b/i, "closed")
      .replace(/,?\s+on (?:the occasion|account) of\b/i, " for")
      .replace(/,?\s+as per\b[\s\S]*$/i, "")
      .replace(/[.!?]+$/g, "");
    const mainSubject = (topic || action).split(" and ")[0];
    const source =
      (mainSubject &&
        sentences.find(
          (sentence) =>
            sentence.toLowerCase().includes(mainSubject.toLowerCase()) &&
            sentence.match(DATE),
        )) ||
      (lead?.match(DATE) ? lead : null) ||
      sentences.find(
        (sentence) =>
          /\b(?:effective|deadline|due|by|on or before)\b/i.test(sentence) &&
          sentence.match(DATE),
      );
    const detail = schedule?.date
      ? { value: schedule.date, relation: " on " }
      : dateDetail(source);
    if (detail && !title.includes(detail.value)) {
      title += `${detail.relation}${detail.value}`;
    }
    return shortenTitle(title);
  }
  const subject = clean(heading)
    .replace(
      /^(?:notice|circular|announcement)\s+(?:regarding|for|on|about)\s*:?\s*/i,
      "",
    )
    .replace(/^subject\s*:\s*/i, "");
  if (!words(subject).length || REFERENCE.test(subject))
    return shorten(topic || lead, 120);
  let title = subject.charAt(0).toLocaleUpperCase() + subject.slice(1);
  const datedBody =
    sentences.find(
      (sentence) => ACTION.test(sentence) && dateDetail(sentence),
    ) || sentences.find((sentence) => dateDetail(sentence));
  if (/\b(?:will be held|scheduled|take place|begins?|starts?)\b/i.test(lead)) {
    const codes = [
      ...new Set(lead.match(/\b[A-Z]{2,8}-\d{3,5}\b/g) || []),
    ].slice(0, 2);
    if (codes.length && !codes.some((code) => title.includes(code)))
      title += ` for ${codes.join(" and ")}`;
  }
  const detail = dateDetail(datedBody);
  if (detail && !title.includes(detail.value))
    title += `${detail.relation}${detail.value}`;
  return shortenTitle(title);
}

export function analyzeNoticeText(source) {
  const { heading, sentences, schedule } = segments(source);
  const table = tableFacts(schedule);
  const scheduledSubject = scheduleSubject(sentences);
  if (
    table &&
    scheduledSubject &&
    (!heading || GENERIC_HEADING.test(heading))
  ) {
    const title = shortenTitle(`${scheduledSubject.title}, ${table.dateRange}`);
    return {
      title,
      summary: `${scheduledSubject.summary} ${table.text}`,
      keywords: table.entries
        .filter((entry) => entry.date || entry.time)
        .map(
          (entry) =>
            `${entry.label}: ${[entry.date, entry.time].filter(Boolean).join(", ")}`,
        ),
      category: /\b(?:admission|exam|test)\b/i.test(title)
        ? "EXAM"
        : "ANNOUNCEMENT",
      needsReview: table.needsReview,
      warning: table.needsReview
        ? "One or more table dates could not be read clearly. Check the original and edit the details before publishing."
        : "Review the extracted wording and dates against the original document before publishing.",
    };
  }
  if (table?.departments.length && /\badmit card\b/i.test(heading)) {
    const codes = table.departments.map((entry) => entry.code);
    const joinedCodes =
      codes.length > 1
        ? `${codes.slice(0, -1).join(", ")} and ${codes.at(-1)}`
        : codes[0];
    const issue = dateDetail(
      sentences.find(
        (sentence) =>
          /\bregistration\b/i.test(sentence) && dateDetail(sentence),
      ),
    );
    const body = sentences.join(" ");
    const requirements = [
      /\b(?:payment clearance|pay(?:ing)? all dues|tuition fees)\b/i.test(
        body,
      ) && "payment clearance",
      /\b(?:prior authority|consent from.*authority)\b/i.test(body) &&
        "prior authority consent",
    ].filter(Boolean);
    const requirementText = requirements.length
      ? ` ${requirements[0][0].toUpperCase()}${requirements[0].slice(1)}${requirements[1] ? ` and ${requirements[1]}` : ""} ${requirements.length > 1 ? "are" : "is"} required for issuance.`
      : "";
    const location =
      /\bGround Floor\b/i.test(schedule.join(" ")) &&
      /\bBuilding\s*[-–]?\s*2\b/i.test(schedule.join(" "))
        ? " Collection point: Ground Floor, Office of the Controller of Examinations (Building 2)."
        : "";
    const title = shortenTitle(
      `${heading.replace(/^notice\s+(?:regarding|for|on|about)\s*/i, "")} for ${joinedCodes} on ${table.primaryDate}`,
    );
    return {
      title,
      summary:
        `${issue ? `Registration deadline: ${issue.value}. ` : ""}Admit cards for ${joinedCodes} can be collected on ${table.primaryDate}.${location}${requirementText}`.trim(),
      keywords: [
        ...(issue ? [`Registration deadline: ${issue.value}`] : []),
        `Admit card collection: ${joinedCodes} on ${table.primaryDate}`,
      ],
      category: "EXAM",
      needsReview: false,
      warning:
        "Review the extracted wording and dates against the original document before publishing.",
    };
  }
  const phrase = topicPhrase(sentences);
  const topic = new Set(words(`${heading} ${phrase}`));
  const ranked = sentences
    .map((part, position) => ({
      part,
      position,
      value: score(part, position, topic),
    }))
    .sort((a, b) => b.value - a.value || a.position - b.position);
  const lead = ranked[0];
  if (!lead || lead.value < 3) {
    return {
      title: heading ? titleFrom(heading, "", phrase, sentences, null) : "",
      summary: lead?.part || "",
      keywords: [],
      category: "ANNOUNCEMENT",
      needsReview: true,
      warning:
        "No clear notice details were found. Enter a title and check the document before publishing.",
    };
  }
  const selected = [lead];
  for (const candidate of ranked.slice(1)) {
    if (selected.length === 3) break;
    if (candidate.value >= 3 && distinct(candidate, selected))
      selected.push(candidate);
  }
  selected.sort((a, b) => a.position - b.position);
  const facts = scheduleFacts(schedule);
  const summary = [
    ...selected.flatMap((item, index) =>
      index === 0 &&
      facts &&
      /\bwill be held\.$/i.test(summarySentence(item.part))
        ? [
            summarySentence(item.part).replace(
              /\.$/,
              [
                facts.date && ` on ${facts.date}`,
                facts.time && ` at ${facts.time}`,
                facts.place && ` at ${facts.place}`,
              ]
                .filter(Boolean)
                .join("") + ".",
            ),
          ]
        : index === 0 && facts
          ? [summarySentence(item.part), facts.text]
          : [summarySentence(item.part)],
    ),
  ].join(" ");
  const title = titleFrom(heading, lead.part, phrase, sentences, facts);
  const weakTitle =
    /^(?:the following schedule|following schedule|this is to inform|(?:it|tt|lt|ii) is hereby|ref(?:erence)?\s*:|date\s*:|notice\b|by order\b|copy forwarded\b)/i.test(
      title,
    );
  const missingDate =
    (Boolean(facts?.date) ||
      sentences.some((sentence) => dateDetail(sentence))) &&
    !dateDetail(title);
  const category =
    EVENT_PATTERNS.find((item) => item.pattern.test(`${heading} ${lead.part}`))
      ?.category || "ANNOUNCEMENT";
  return {
    title: shortenTitle(title),
    summary,
    keywords: selected.map((item) => shorten(item.part, 360)),
    category,
    needsReview: weakTitle || missingDate,
    warning:
      weakTitle || missingDate
        ? "The suggested title may be missing the notice topic or date. Check the original and edit it before publishing."
        : "Review the extracted wording and dates against the original document before publishing.",
  };
}
