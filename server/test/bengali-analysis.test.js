import test from "node:test";
import assert from "node:assert/strict";
import { analyzeNoticeText } from "../notice-analysis.js";

test("Bengali scanned event notices keep the subject, event dates, and distinct discounts", () => {
  const notice = analyzeNoticeText([
    "North Western University",
    "Ref : এনডব্লিউইউ/রেজি./বিজ্ঞপ্তি/ফেয়ার/২০২৬/৭০৫",
    "Date: ০৫/১১/২০২৬খ্রি.",
    "বিজ্ঞপ্তি",
    "নর্থওয়েস্টার্নইউনিভার্সিটিতেভর্তিচ্ছুশিক্ষার্থীসহসংশ্লিষ্টসকলেরঅবগতিরজন্যজানানোযাচ্ছেযে, বিশ্ববিদ্যালয়ের",
    "'খ্যাডমিশন",
    "ফেয়ারস্প্িং-২০২৭' আগামী৯ইনভেম্বর২০২৬খ্রি. তারিখথেকে২১শেনভেম্বর২০২৬খ্রি, তারিখপর্যন্ত",
    "অনুষ্ঠিত হবে।উল্লেখ্যযে, মেধারভিত্তিতেশিক্ষার্থীরাআপটু১০০% ছাড়সহবিভিন্নসুযোগসুবিধা",
    "এবংশুধুমাত্রএ্যাডমিশনফেয়ারউপলক্ষেশিক্ষার্থীরাটিউশনফিসএরউপরঅতিরিক্ত১০% ছাড়পাবেন।",
    "রেজিস্ট্রার",
    "সদয়অবগতিওপ্রয়োজনীয়ব্যবস্থাগ্রহণেরজন্যঅনুলিপিপ্রেরণকরাহলো",
  ].join("\n"));
  assert.equal(notice.title, "অ্যাডমিশন ফেয়ার স্প্রিং-২০২৭: ৯–২১ নভেম্বর ২০২৬");
  assert.match(notice.summary, /মেধার ভিত্তিতে ১০০% পর্যন্ত ছাড়/);
  assert.match(notice.summary, /টিউশন ফিতে অতিরিক্ত ১০% ছাড়/);
  assert(!/রেজিস্ট্রার|অনুলিপি|০৫\/১১\/২০২৬/u.test(notice.summary));
  assert.equal(notice.category, "EVENT");
  assert.equal(notice.needsReview, false);
});

test("Bengali closure notices use the closure date rather than the issue date", () => {
  const notice = analyzeNoticeText([
    "তারিখ: ১০ নভেম্বর ২০২৬",
    "বিজ্ঞপ্তি",
    "সকলের অবগতির জন্য জানানো যাচ্ছে যে, বিশ্ববিদ্যালয় আগামী ১২ নভেম্বর ২০২৬ তারিখে বন্ধ থাকবে।",
    "রেজিস্ট্রার",
    "অনুলিপি: সকল বিভাগীয় প্রধান",
  ].join("\n"));
  assert.match(notice.title, /বিশ্ববিদ্যালয় বন্ধ.*১২ নভেম্বর ২০২৬/u);
  assert.match(notice.summary, /১২ নভেম্বর ২০২৬ বন্ধ থাকবে/u);
  assert(!notice.title.includes("১০ নভেম্বর"));
});

test("Bengali notices without a readable date request review", () => {
  const notice = analyzeNoticeText([
    "বিজ্ঞপ্তি",
    "শিক্ষার্থীদের জন্য গবেষণা অনুদানের আবেদন গ্রহণ করা হচ্ছে।",
    "আবেদনপত্র বিভাগীয় কার্যালয়ে জমা দিতে হবে।",
  ].join("\n"));
  assert.match(notice.title, /গবেষণা অনুদান/u);
  assert.equal(notice.needsReview, true);
  assert(!notice.summary.includes("রেজিস্ট্রার"));
});

test("Bengali numeric dates and short ranges become readable titles", () => {
  const numeric = analyzeNoticeText([
    "বিজ্ঞপ্তি",
    "বিশ্ববিদ্যালয়ের পাঠদান ১২/১১/২০২৬ তারিখে বন্ধ থাকবে।",
  ].join("\n"));
  assert.match(numeric.title, /১২ নভেম্বর ২০২৬/u);
  assert(!numeric.title.includes("১২/১১/২০২৬"));
  const range = analyzeNoticeText([
    "বিজ্ঞপ্তি",
    "'গবেষণা কর্মশালা' ১৫-২১ নভেম্বর ২০২৬ পর্যন্ত অনুষ্ঠিত হবে।",
  ].join("\n"));
  assert.match(range.title, /১৫–২১ নভেম্বর ২০২৬/u);
});

test("reference letter dates do not replace the date of a Bengali programme", () => {
  const notice = analyzeNoticeText([
    "Ref: এনডব্লিউইউ/রেজি./বিজ্ঞপ্তি/২০২৬/৯১২",
    "Date: ৫ নভেম্বর ২০২৬",
    "বিজ্ঞপ্তি",
    "সকলেরঅবগতিরজন্যজানানোযাচ্ছেযে, মন্ত্রিপরিষদ বিভাগের গত০১/১১/২০২৬খ্রি, তারিখেরস্যারকনর০৪.০০.০০০০-২২-১৪৮এবং",
    "মাধ্যমিকওউচ্চশিক্ষাঅধিদপ্তরের গত০৩/১১/২০২৬খ্রি. তারিখেরস্মারকলন্বর৩৭.০২.০০০০-১০১-১৮.০০১-২৬-এরপ্রজ্ঞাপনঅনুযায়ী",
    "আগামী০৭/১১/২০২৬ খ্রি. তারিখরোজশনিবার'জাতীয়বিপ্লবওসংহতিদিবস' উদযাপনউপলক্ষ্যেএবিশ্ববিদ্যালয়েরপক্ষথেকেনিলরকূপকর্মসূচিগ্রহণকরাহয়েছে।",
    "আলোচনা সভা(ভবন-১, রুমনং, ২০১-২০২) সকাল১১০০টা।",
    "রচনালিখতেহবেএবংলিখিতকপিআগামী৯ই নভেম্বর২০২৬ তারিখবিকাল৪টারমধ্যেজামাপ্রদানকরবে।",
    "রেজিস্ট্রার",
  ].join("\n"));
  assert.equal(notice.title, "জাতীয় বিপ্লব ও সংহতি দিবস: ৭ নভেম্বর ২০২৬");
  assert.match(notice.summary, /আলোচনা সভার কর্মসূচি/u);
  assert.match(notice.summary, /রচনা জমা: ৯ নভেম্বর ২০২৬/u);
  assert(!/০১–০৩|৫ নভেম্বর ২০২৬/u.test(notice.title));
  assert.equal(notice.category, "EVENT");
});
