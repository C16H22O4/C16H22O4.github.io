const state = {
  mode: "home",
  q: "",
  school: "",
  personPage: 1,
  competitionPage: 1,
  schoolPage: 1,
  schoolDetailPage: 1,
  currentSchool: "",
};

const PAGE_SIZE = 50;
const QUERY_INTERVAL_MS = 500;
const QUERY_RATE_WINDOW_MS = 1000;
const QUERY_RATE_MAX_REQUESTS = 10;

const columns = [
  ["nationalFirst", "国一"],
  ["nationalSecond", "国二"],
  ["nationalThird", "国三"],
  ["provincialFirst", "省一"],
  ["provincialSecond", "省二"],
  ["provincialThird", "省三"],
  ["total", "总计"],
];

const CHAMPION_BADGE_CONFIG = {
  provincial: {
    className: "champion-blue",
    tooltip: "曾获省赛第一名",
    image: "",
  },
  national: {
    className: "champion-gold",
    tooltip: "曾获国赛第一名",
    image: "",
  },
};

const views = {
  home: document.querySelector("#home-view"),
  search: document.querySelector("#search-view"),
  school: document.querySelector("#school-view"),
  detail: document.querySelector("#detail-view"),
  schoolDetail: document.querySelector("#school-detail-view"),
};

const startupLoading = document.querySelector("#startup-loading");
const form = document.querySelector("#search-form");
const schoolForm = document.querySelector("#school-form");
const navLinks = document.querySelectorAll(".nav-link");
const jumpButtons = document.querySelectorAll("[data-jump]");
const personControls = document.querySelector("#person-controls");
const competitionControls = document.querySelector("#competition-controls");
const qInput = document.querySelector("#q-input");
const schoolInput = document.querySelector("#school-input");
const resultsBody = document.querySelector("#results-body");
const emptyState = document.querySelector("#empty-state");
const personTableWrap = document.querySelector("#person-table-wrap");
const competitionTableWrap = document.querySelector("#competition-table-wrap");
const competitionBody = document.querySelector("#competition-body");
const competitionEmpty = document.querySelector("#competition-empty");
const scopeSelect = document.querySelector("#scope-select");
const provinceCombo = document.querySelector("#province-combo");
const provinceSearch = document.querySelector("#province-search");
const provinceValue = document.querySelector("#province-value");
const provinceMenu = document.querySelector("#province-menu");
const editionSelect = document.querySelector("#edition-select");
const languageSelect = document.querySelector("#language-select");
const groupSelect = document.querySelector("#group-select");
const competitionSchool = document.querySelector("#competition-school");
const competitionKeyword = document.querySelector("#competition-keyword");
const competitionSubmit = document.querySelector("#competition-submit");
const metaLine = document.querySelector("#meta-line");
const schoolMetaLine = document.querySelector("#school-meta-line");
const schoolRankInput = document.querySelector("#school-rank-input");
const schoolTableWrap = document.querySelector("#school-table-wrap");
const schoolBody = document.querySelector("#school-body");
const schoolEmpty = document.querySelector("#school-empty");
const schoolDetailTableWrap = document.querySelector("#school-detail-table-wrap");
const schoolDetailBody = document.querySelector("#school-detail-body");
const schoolDetailEmpty = document.querySelector("#school-detail-empty");
const schoolDetailName = document.querySelector("#school-detail-name");
const schoolDetailMeta = document.querySelector("#school-detail-meta");
const schoolDetailStats = document.querySelector("#school-detail-stats");
const homeStats = document.querySelector("#home-stats");
const homeContestants = document.querySelector("#home-contestants");
const homeSchools = document.querySelector("#home-schools");
const backButton = document.querySelector("#back-button");
const schoolBackButton = document.querySelector("#school-back-button");
const homeLink = document.querySelector("[data-home]");
const pagers = {
  person: {
    bar: document.querySelector("#person-pagination"),
    summary: document.querySelector("#person-page-summary"),
    input: document.querySelector("#person-page-input"),
    total: document.querySelector("#person-page-total"),
    prev: document.querySelector("#person-prev-page"),
    next: document.querySelector("#person-next-page"),
    goto: document.querySelector("#person-goto-page"),
  },
  competition: {
    bar: document.querySelector("#competition-pagination"),
    summary: document.querySelector("#competition-page-summary"),
    input: document.querySelector("#competition-page-input"),
    total: document.querySelector("#competition-page-total"),
    prev: document.querySelector("#competition-prev-page"),
    next: document.querySelector("#competition-next-page"),
    goto: document.querySelector("#competition-goto-page"),
  },
  school: {
    bar: document.querySelector("#school-pagination"),
    summary: document.querySelector("#school-page-summary"),
    input: document.querySelector("#school-page-input"),
    total: document.querySelector("#school-page-total"),
    prev: document.querySelector("#school-prev-page"),
    next: document.querySelector("#school-next-page"),
    goto: document.querySelector("#school-goto-page"),
  },
  schoolDetail: {
    bar: document.querySelector("#school-detail-pagination"),
    summary: document.querySelector("#school-detail-page-summary"),
    input: document.querySelector("#school-detail-page-input"),
    total: document.querySelector("#school-detail-page-total"),
    prev: document.querySelector("#school-detail-prev-page"),
    next: document.querySelector("#school-detail-next-page"),
    goto: document.querySelector("#school-detail-goto-page"),
  },
};
let searchTimer = 0;
let recentQueryTimes = [];
let provinceOptions = [];
let competitionOptions = { languages: [], groups: [], subjectsByEdition: {} };
let dataProvider = null;
const lastSearchInputKeys = { person: "", competition: "", school: "" };
const activeSearchRequestKeys = { person: "", school: "" };
const lastCompletedSearchRequestKeys = { person: "", school: "" };

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatInt(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

function pageKey(mode) {
  return `${mode}Page`;
}

function pageCount(total) {
  return Math.max(1, Math.ceil(Number(total || 0) / PAGE_SIZE));
}

function currentPage(mode) {
  return Math.max(1, Number(state[pageKey(mode)] || 1));
}

function setCurrentPage(mode, page) {
  state[pageKey(mode)] = Math.max(1, Number(page) || 1);
}

function resetPage(mode) {
  if (["person", "competition", "school", "schoolDetail"].includes(mode)) {
    setCurrentPage(mode, 1);
  }
}

function parsePage(value) {
  const page = Number.parseInt(value || "1", 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function addPageToUrl(params, page) {
  if (page > 1) {
    params.set("page", String(page));
  }
}

function apiParams(params, page) {
  const next = new URLSearchParams(params);
  next.set("limit", String(PAGE_SIZE));
  next.set("offset", String((page - 1) * PAGE_SIZE));
  return next;
}

function hasSearchInputKey(mode) {
  return Object.prototype.hasOwnProperty.call(lastSearchInputKeys, mode);
}

function currentSearchInputKey(mode) {
  if (mode === "person") {
    return `${qInput.value.trim()}\u0000${schoolInput.value.trim()}`;
  }
  if (mode === "competition") {
    return `${competitionSchool.value.trim()}\u0000${competitionKeyword.value.trim()}`;
  }
  if (mode === "school") {
    return schoolRankInput.value.trim();
  }
  return "";
}

function syncSearchInputKey(mode) {
  if (hasSearchInputKey(mode)) {
    lastSearchInputKeys[mode] = currentSearchInputKey(mode);
  }
}

function searchRequestKey(mode, params, page) {
  const keyParams = new URLSearchParams(params);
  keyParams.delete("mode");
  keyParams.set("page", String(page));
  return `${mode}:${keyParams.toString()}`;
}

function isRepeatedSearchRequest(mode, key) {
  return activeSearchRequestKeys[mode] === key || lastCompletedSearchRequestKeys[mode] === key;
}

function markSearchRequestStarted(mode, key) {
  activeSearchRequestKeys[mode] = key;
}

function markSearchRequestFinished(mode, key, completed) {
  if (activeSearchRequestKeys[mode] === key) {
    activeSearchRequestKeys[mode] = "";
  }
  if (completed) {
    lastCompletedSearchRequestKeys[mode] = key;
  }
}

function hidePagination(mode) {
  pagers[mode].bar.hidden = true;
}

function hideOtherSearchPagination(mode) {
  if (mode !== "person") hidePagination("person");
  if (mode !== "competition") hidePagination("competition");
  if (mode !== "school") hidePagination("school");
  if (mode !== "schoolDetail") hidePagination("schoolDetail");
}

function updatePagination(mode, total) {
  const pager = pagers[mode];
  const page = currentPage(mode);
  const pages = pageCount(total);
  if (!Number(total || 0)) {
    hidePagination(mode);
    return;
  }
  pager.bar.hidden = false;
  pager.summary.textContent = `共 ${formatInt(total)} 条 · 每页 ${PAGE_SIZE} 条`;
  pager.input.value = String(page);
  pager.input.max = String(pages);
  pager.total.textContent = `/ ${formatInt(pages)} 页`;
  pager.prev.disabled = page <= 1;
  pager.next.disabled = page >= pages;
}

function ensurePageInRange(mode, total, rerun) {
  const pages = pageCount(total);
  if (Number(total || 0) > 0 && currentPage(mode) > pages) {
    setCurrentPage(mode, pages);
    rerun(false);
    return false;
  }
  return true;
}

function gotoPage(mode, rawPage) {
  const pager = pagers[mode];
  const max = Number(pager.input.max || 1);
  const page = Math.min(Math.max(1, parsePage(rawPage)), max);
  if (page === currentPage(mode)) {
    pager.input.value = String(page);
    return;
  }
  setCurrentPage(mode, page);
  if (mode === "schoolDetail") {
    showSchoolDetail(state.currentSchool, true);
  } else if (mode === "competition") {
    runCompetitionSearch();
  } else if (mode === "school") {
    runSchoolSearch();
  } else {
    runSearch();
  }
}

function bindPager(mode) {
  const pager = pagers[mode];
  pager.prev.addEventListener("click", () => gotoPage(mode, currentPage(mode) - 1));
  pager.next.addEventListener("click", () => gotoPage(mode, currentPage(mode) + 1));
  pager.goto.addEventListener("click", () => gotoPage(mode, pager.input.value));
  pager.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      gotoPage(mode, pager.input.value);
    }
  });
}

function championBadges(item) {
  const badges = [];
  if (item.hasNationalChampion) {
    badges.push(championBadge(CHAMPION_BADGE_CONFIG.national));
  }
  if (item.hasProvincialChampion) {
    badges.push(championBadge(CHAMPION_BADGE_CONFIG.provincial));
  }
  return badges.join("");
}

function championBadge(config) {
  const image = config.image
    ? `<img class="champion-badge-image" src="${escapeHtml(config.image)}" alt="">`
    : "✓";
  return `<span class="champion-badge ${escapeHtml(config.className)}" title="${escapeHtml(config.tooltip)}" data-tooltip="${escapeHtml(config.tooltip)}">${image}</span>`;
}

function nameWithBadges(item) {
  return `<span class="name-with-badges">${championBadges(item)}<span>${escapeHtml(item.name)}</span></span>`;
}

function textTokens(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, "");
}

function provinceScore(option, query) {
  const q = textTokens(query);
  if (!q) return 100;
  const norm = option.norm || textTokens(option.label);
  const pinyin = option.pinyin || "";
  const initials = option.initials || "";
  if (q === norm) return 100;
  if (norm.startsWith(q)) return 94;
  if (norm.includes(q)) return 88;
  if (initials.startsWith(q)) return 92;
  if (initials.includes(q)) return 82;
  if (pinyin.startsWith(q)) return 90;
  if (pinyin.includes(q)) return 78;
  return fuzzySubsequenceScore(q, [norm, pinyin, initials]);
}

function fuzzySubsequenceScore(query, values) {
  for (const value of values) {
    let qi = 0;
    for (const char of value) {
      if (char === query[qi]) qi += 1;
      if (qi === query.length) return 62;
    }
  }
  return 0;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function getJson(url) {
  return fetchJson(url);
}

function normalizeClientText(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, "");
}

function compareMedalDesc(a, b) {
  for (const [key] of columns) {
    if (key === "total") continue;
    const diff = Number(b[key] || 0) - Number(a[key] || 0);
    if (diff) return diff;
  }
  return Number(b.total || 0) - Number(a.total || 0);
}

function paginateItems(items, limit, offset) {
  const start = Number(offset || 0);
  const end = start + Number(limit || PAGE_SIZE);
  return items.slice(start, end);
}

function detailShardForPid(pid) {
  return Math.max(0, Math.floor((Number(pid) - 1) / dataProvider.manifest.detailShardSize));
}

function peopleShardForRow(rowNo) {
  return Math.max(0, Math.floor((Number(rowNo) - 1) / dataProvider.manifest.personShardSize));
}

function tokenShard(token) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % dataProvider.manifest.tokenShards;
}

async function createDataProvider() {
  try {
    await fetchJson("/api/meta");
    return new ApiDataProvider();
  } catch {
    const manifest = await fetchJson("/data/manifest.json");
    return new StaticDataProviderV2(manifest);
  }
}

class ApiDataProvider {
  async meta() {
    return fetchJson("/api/meta");
  }

  async home() {
    return fetchJson("/api/home");
  }

  async competitionOptions() {
    return fetchJson("/api/competition-options");
  }

  async search(params, page) {
    return fetchJson(`/api/search?${apiParams(params, page).toString()}`);
  }

  async competition(params, page) {
    return fetchJson(`/api/competition?${apiParams(params, page).toString()}`);
  }

  async schools(params, page) {
    return fetchJson(`/api/schools?${apiParams(params, page).toString()}`);
  }

  async contestant(id) {
    return fetchJson(`/api/contestants/${encodeURIComponent(id)}`);
  }

  async schoolDetail(school, page) {
    const params = apiParams(new URLSearchParams(), page);
    return fetchJson(`/api/schools/${encodeURIComponent(school)}?${params.toString()}`);
  }
}

class StaticDataProvider {
  constructor(manifest) {
    this.manifest = manifest;
    this.cache = new Map([["/data/manifest.json", manifest]]);
    this.personById = new Map();
    this.personByPid = new Map();
    this.schoolByName = new Map();
  }

  async load(path) {
    if (!this.cache.has(path)) {
      this.cache.set(path, fetchJson(path));
    }
    return this.cache.get(path);
  }

  async meta() {
    return this.load("/data/meta.json");
  }

  async home() {
    return this.load("/data/home.json");
  }

  async competitionOptions() {
    return this.load("/data/options.json");
  }

  async loadPeopleShard(shard) {
    const items = await this.load(`/data/people/${shard}.json`);
    for (const item of items) {
      this.personById.set(item.id, item);
      this.personByPid.set(item.pid, item);
    }
    return items;
  }

  async loadPersonByPid(pid) {
    if (this.personByPid.has(pid)) return this.personByPid.get(pid);
    const rowNo = Number(pid);
    const shard = peopleShardForRow(rowNo);
    await this.loadPeopleShard(shard);
    return this.personByPid.get(pid);
  }

  async loadDetailShard(pid) {
    return this.load(`/data/details/${detailShardForPid(pid)}.json`);
  }

  async allSchools() {
    const schools = await this.load("/data/schools/index.json");
    for (const school of schools) {
      this.schoolByName.set(school.school, school);
    }
    return schools;
  }

  async tokenIds(kind, token) {
    const key = `${kind}:${token}`;
    const shard = tokenShard(key).toString(16).padStart(2, "0");
    const payload = await this.load(`/data/search/${shard}.json`);
    return payload[key] || [];
  }

  async candidateIds(query) {
    const q = normalizeClientText(query);
    if (!q) return [];
    if (/^[0-9a-z]{1,24}$/.test(q)) {
      const ids = new Set();
      for (const token of [q]) {
        for (const id of await this.tokenIds("p", token)) ids.add(id);
      }
      return [...ids];
    }
    const chars = [...new Set([...q].filter(Boolean))];
    let current = null;
    for (const char of chars) {
      const ids = new Set(await this.tokenIds("c", char));
      current = current === null ? ids : new Set([...current].filter((id) => ids.has(id)));
      if (!current.size) break;
    }
    return [...(current || [])];
  }

  async search(params, page) {
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const q = normalizeClientText(params.get("q"));
    const school = normalizeClientText(params.get("school"));
    const asciiQuery = /^[0-9a-z]{1,24}$/.test(q);
    if (!q && !school) {
      const startShard = peopleShardForRow(offset + 1);
      const endShard = peopleShardForRow(offset + limit);
      const items = [];
      for (let shard = startShard; shard <= endShard; shard += 1) {
        items.push(...await this.loadPeopleShard(shard));
      }
      return {
        total: this.manifest.meta.contestantCount,
        items: items.slice(offset - startShard * this.manifest.personShardSize, offset - startShard * this.manifest.personShardSize + limit),
        limit,
        offset,
      };
    }
    const ids = q ? await this.candidateIds(q) : Array.from({ length: this.manifest.meta.contestantCount }, (_, index) => index + 1);
    const items = [];
    for (const pid of ids) {
      const item = await this.loadPersonByPid(pid);
      if (!item) continue;
      if (school && !normalizeClientText(item.school).includes(school)) continue;
      if (q && !asciiQuery && !normalizeClientText(item.name).includes(q)) continue;
      items.push(item);
    }
    items.sort((a, b) => Number(a.pid) - Number(b.pid));
    return { total: items.length, items: paginateItems(items, limit, offset), limit, offset };
  }

  async competition(params, page) {
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const scope = params.get("scope") || "";
    const edition = params.get("edition") || "";
    const language = params.get("language") || "";
    const group = params.get("group") || "";
    const province = params.get("province") || "";
    if (!scope) return { error: "competition_scope_required", message: "请选择省赛或国赛后再查询。" };
    if (scope === "provincial" && !province) return { error: "province_required", message: "查询省赛名单时必须选择省份。" };
    const options = await this.competitionOptions();
    const dict = await this.load("/data/dict.json");
    const provinceId = scope === "provincial" ? await this.provinceId(province) : 0;
    const index = await this.load("/data/competitions/index.json");
    const subjects = (dict.subjects || []).filter((subject) => {
      if (language && subject.language !== language) return false;
      if (group && subject.group_name !== group) return false;
      return true;
    });
    const editions = edition ? [edition] : (options.editions || []).map((item) => String(item.value));
    const items = [];
    for (const ed of editions) {
      for (const subject of subjects) {
        const key = `${scope === "provincial" ? "P" : "N"}_${provinceId}_${ed}_${subject.subject_id}`;
        if (!index[key]) continue;
        const payload = await this.load(`/data/competitions/${key}.json`);
        items.push(...(payload.items || []));
      }
    }
    const schoolQ = normalizeClientText(params.get("school"));
    const q = normalizeClientText(params.get("q"));
    let filtered = items;
    if (schoolQ) filtered = filtered.filter((item) => normalizeClientText(item.school).includes(schoolQ));
    if (q) filtered = filtered.filter((item) => normalizeClientText(item.name).includes(q));
    filtered.sort((a, b) =>
      Number(b.edition || 0) - Number(a.edition || 0) ||
      String(a.language || "").localeCompare(String(b.language || ""), "zh-CN") ||
      String(a.group || "").localeCompare(String(b.group || ""), "zh-CN") ||
      Number(a.rank || 0) - Number(b.rank || 0) ||
      String(a.region || "").localeCompare(String(b.region || ""), "zh-CN")
    );
    return { total: filtered.length, items: paginateItems(filtered, limit, offset), limit, offset };
  }

  async provinceId(province) {
    const dict = await this.load("/data/dict.json");
    const found = (dict.provinces || []).find((item) => item.value === province);
    return found ? Number(found.id || 0) : 0;
  }

  async schools(params, page) {
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const q = normalizeClientText(params.get("q"));
    let items = await this.allSchools();
    if (q) items = items.filter((item) => normalizeClientText(item.school).includes(q));
    return { total: items.length, items: paginateItems(items, limit, offset), limit, offset };
  }

  async contestant(id) {
    const personIndex = await this.load("/data/person_index.json");
    const pid = personIndex[id];
    if (!pid) throw new Error("not found");
    const detail = await this.load(`/data/details/${detailShardForPid(pid)}.json`);
    if (detail[id]) return detail[id];
    throw new Error("not found");
  }

  async schoolDetail(school, page) {
    const schools = await this.allSchools();
    const summary = schools.find((item) => item.school === school);
    if (!summary) throw new Error("not found");
    const params = apiParams(new URLSearchParams(), page);
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const items = await this.load(`/data/schools/${summary.sid}.json`);
    return {
      school: summary,
      total: items.length,
      items: paginateItems(items, limit, offset),
      limit,
      offset,
    };
  }
}

class StaticDataProviderV2 {
  constructor(manifest) {
    this.manifest = manifest;
    this.cache = new Map([["/data/manifest.json", manifest]]);
    this.personById = new Map();
    this.personByPid = new Map();
    this.personByRow = new Map();
    this.lookupById = new Map();
    this.schoolByName = new Map();
    this.schoolById = new Map();
    this.subjectById = new Map();
    this.provinceById = new Map();
    this.provinceIdByName = new Map();
    this.regionById = new Map();
    this.dictionariesPromise = null;
  }

  async load(path) {
    if (!this.cache.has(path)) {
      this.cache.set(path, fetchJson(path));
    }
    return this.cache.get(path);
  }

  async dictionaries() {
    if (!this.dictionariesPromise) {
      this.dictionariesPromise = this.load("/data/dict.json").then((dict) => {
        for (const raw of dict.schools || []) {
          const item = Array.isArray(raw)
            ? { id: raw[0], school: raw[1], norm: raw[2] }
            : { id: raw.id, school: raw.school, norm: raw.norm };
          this.schoolById.set(Number(item.id), item);
          this.schoolByName.set(item.school, item);
        }
        for (const raw of dict.subjects || []) {
          const item = Array.isArray(raw)
            ? { subject_id: raw[0], language: raw[1], group_name: raw[2], code: raw[3], display_name: raw[4] }
            : raw;
          this.subjectById.set(Number(item.subject_id), item);
        }
        for (const raw of dict.provinces || []) {
          const item = Array.isArray(raw)
            ? { id: raw[0], value: raw[1], label: raw[1], total: raw[2], norm: raw[3], pinyin: raw[4], initials: raw[5] }
            : raw;
          this.provinceById.set(Number(item.id), item);
          this.provinceIdByName.set(item.value, Number(item.id));
        }
        for (const raw of dict.regions || []) {
          const item = Array.isArray(raw) ? { id: raw[0], region: raw[1] } : raw;
          this.regionById.set(Number(item.id), item.region || "");
        }
        return dict;
      });
    }
    return this.dictionariesPromise;
  }

  async meta() {
    return this.load("/data/meta.json");
  }

  async home() {
    await this.dictionaries();
    const payload = await this.load("/data/home.json");
    return {
      meta: payload.meta,
      topContestants: (payload.topContestants || []).map((item) => this.decodePerson(item)),
      topSchools: (payload.topSchools || []).map((item) => this.decodeSchool(item)),
    };
  }

  async competitionOptions() {
    return this.load("/data/options.json");
  }

  decodePerson(raw) {
    if (!Array.isArray(raw)) return raw;
    const school = this.schoolById.get(Number(raw[4])) || { school: "", norm: "" };
    return {
      rowNo: Number(raw[0]),
      pid: Number(raw[1]),
      id: raw[2],
      name: raw[3],
      schoolId: Number(raw[4]),
      school: school.school,
      schoolNorm: school.norm,
      nationalFirst: Number(raw[5] || 0),
      nationalSecond: Number(raw[6] || 0),
      nationalThird: Number(raw[7] || 0),
      provincialFirst: Number(raw[8] || 0),
      provincialSecond: Number(raw[9] || 0),
      provincialThird: Number(raw[10] || 0),
      total: Number(raw[11] || 0),
      hasProvincialChampion: Boolean(Number(raw[12] || 0) & 1),
      hasNationalChampion: Boolean(Number(raw[12] || 0) & 2),
    };
  }

  decodeSchool(raw) {
    if (!Array.isArray(raw)) return raw;
    return {
      sid: Number(raw[0]),
      school: raw[1],
      bestRank: raw[2] || "",
      nationalFirst: Number(raw[3] || 0),
      nationalSecond: Number(raw[4] || 0),
      nationalThird: Number(raw[5] || 0),
      provincialFirst: Number(raw[6] || 0),
      provincialSecond: Number(raw[7] || 0),
      provincialThird: Number(raw[8] || 0),
      total: Number(raw[9] || 0),
      contestantCount: Number(raw[10] || 0),
      recordCount: Number(raw[11] || 0),
    };
  }

  awardLabel(code) {
    const labels = { 0: "特等奖", 1: "一等奖", 2: "二等奖", 3: "三等奖" };
    return labels[Number(code)] || "";
  }

  awardRank(code) {
    const value = Number(code);
    if (value === 0 || value === 1) return "first";
    if (value === 2) return "second";
    return "third";
  }

  editionLabel(edition) {
    const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    const n = Number(edition || 0);
    let text = String(n);
    if (n <= 10) {
      text = digits[n] || text;
    } else if (n < 20) {
      text = `十${digits[n % 10]}`;
    } else if (n < 100) {
      text = `${digits[Math.floor(n / 10)]}十${n % 10 ? digits[n % 10] : ""}`;
    }
    return `第${text}届`;
  }

  scopeLabel(scopeCode) {
    return Number(scopeCode) === 1 ? "省赛" : "国赛";
  }

  scopeValue(scopeCode) {
    return Number(scopeCode) === 1 ? "provincial" : "national";
  }

  decodeRecord(raw) {
    const subject = this.subjectById.get(Number(raw[5])) || {};
    const province = this.provinceById.get(Number(raw[3])) || {};
    return {
      edition: Number(raw[0]),
      editionLabel: this.editionLabel(raw[0]),
      stage: this.scopeLabel(raw[1]),
      scope: this.scopeValue(raw[1]),
      series: "",
      region: this.regionById.get(Number(raw[2])) || "",
      province: province.value || "",
      rank: Number(raw[4] || 0),
      subject: subject.display_name || "",
      award: this.awardLabel(raw[6]),
      awardRank: this.awardRank(raw[6]),
      bucket: "",
    };
  }

  decodeDeltas(values) {
    const rows = [];
    let current = 0;
    for (const delta of values || []) {
      current += Number(delta || 0);
      rows.push(current);
    }
    return rows;
  }

  intersectSorted(left, right) {
    const result = [];
    let i = 0;
    let j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) {
        result.push(left[i]);
        i += 1;
        j += 1;
      } else if (left[i] < right[j]) {
        i += 1;
      } else {
        j += 1;
      }
    }
    return result;
  }

  mergeSortedUnique(lists) {
    const values = [];
    for (const list of lists) values.push(...list);
    values.sort((a, b) => a - b);
    return values.filter((value, index) => index === 0 || value !== values[index - 1]);
  }

  async loadPeopleShard(shard) {
    await this.dictionaries();
    const rawItems = await this.load(`/data/people/${shard}.json`);
    const items = rawItems.map((item) => this.decodePerson(item));
    for (const item of items) {
      this.personById.set(item.id, item);
      this.personByPid.set(item.pid, item);
      this.personByRow.set(item.rowNo, item);
    }
    return items;
  }

  async loadPersonByRow(rowNo) {
    const key = Number(rowNo);
    if (this.personByRow.has(key)) return this.personByRow.get(key);
    await this.loadPeopleShard(peopleShardForRow(key));
    return this.personByRow.get(key);
  }

  async loadRows(rowNumbers) {
    const shards = new Set(rowNumbers.map((rowNo) => peopleShardForRow(rowNo)));
    await Promise.all([...shards].map((shard) => this.loadPeopleShard(shard)));
    return rowNumbers.map((rowNo) => this.personByRow.get(Number(rowNo))).filter(Boolean);
  }

  async allSchools() {
    await this.dictionaries();
    const schools = (await this.load("/data/schools/index.json")).map((item) => this.decodeSchool(item));
    for (const school of schools) {
      this.schoolByName.set(school.school, school);
    }
    return schools;
  }

  async tokenIds(kind, token) {
    const key = `${kind}:${token}`;
    const shard = tokenShard(key).toString(16).padStart(2, "0");
    const payload = await this.load(`/data/search/${shard}.json`);
    const found = Array.isArray(payload) ? payload.find((entry) => entry[0] === key) : null;
    if (found) return this.decodeDeltas(found[1]);
    return payload[key] || [];
  }

  async candidateIds(query) {
    const q = normalizeClientText(query);
    if (!q) return [];
    if (/^[0-9a-z]{1,24}$/.test(q)) {
      const ids = new Set();
      for (const id of await this.tokenIds("p", q)) ids.add(id);
      return [...ids].sort((a, b) => a - b);
    }
    const chars = [...new Set([...q].filter(Boolean))];
    let current = null;
    for (const char of chars) {
      const ids = await this.tokenIds("c", char);
      current = current === null ? ids : this.intersectSorted(current, ids);
      if (!current.length) break;
    }
    return current || [];
  }

  async rowsForSchoolQuery(query) {
    const q = normalizeClientText(query);
    if (!q) return [];
    const schools = await this.allSchools();
    const lists = [];
    for (const school of schools) {
      const dictSchool = this.schoolById.get(Number(school.sid)) || {};
      const norm = dictSchool.norm || normalizeClientText(school.school);
      if (norm.includes(q)) {
        lists.push(await this.load(`/data/schools/${school.sid}.json`));
      }
    }
    return this.mergeSortedUnique(lists);
  }

  async rowsForSearch(q, school) {
    let rows = q ? await this.candidateIds(q) : null;
    if (school) {
      const schoolRows = await this.rowsForSchoolQuery(school);
      rows = rows === null ? schoolRows : this.intersectSorted(rows, schoolRows);
    }
    if (rows === null) {
      return Array.from({ length: this.manifest.meta.contestantCount }, (_, index) => index + 1);
    }
    return rows;
  }

  async search(params, page) {
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const q = normalizeClientText(params.get("q"));
    const school = normalizeClientText(params.get("school"));
    const asciiQuery = /^[0-9a-z]{1,24}$/.test(q);
    if (!q && !school) {
      const startShard = peopleShardForRow(offset + 1);
      const endShard = peopleShardForRow(offset + limit);
      const items = [];
      for (let shard = startShard; shard <= endShard; shard += 1) {
        items.push(...await this.loadPeopleShard(shard));
      }
      return {
        total: this.manifest.meta.contestantCount,
        items: items.slice(offset - startShard * this.manifest.personShardSize, offset - startShard * this.manifest.personShardSize + limit),
        limit,
        offset,
      };
    }
    let rows = await this.rowsForSearch(q, school);
    if (q && !asciiQuery && q.length > 1) {
      const filteredRows = [];
      for (const rowNo of rows) {
        const item = await this.loadPersonByRow(rowNo);
        if (item && normalizeClientText(item.name).includes(q)) filteredRows.push(rowNo);
      }
      rows = filteredRows;
    }
    return { total: rows.length, items: await this.loadRows(paginateItems(rows, limit, offset)), limit, offset };
  }

  async competition(params, page) {
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const scope = params.get("scope") || "";
    const edition = params.get("edition") || "";
    const language = params.get("language") || "";
    const group = params.get("group") || "";
    const province = params.get("province") || "";
    if (!scope) return { error: "competition_scope_required", message: "请选择省赛或国赛后再查询。" };
    if (scope === "provincial" && !province) return { error: "province_required", message: "查询省赛名单时必须选择省份。" };
    const options = await this.competitionOptions();
    await this.dictionaries();
    const provinceId = scope === "provincial" ? await this.provinceId(province) : 0;
    const index = await this.load("/data/competitions/index.json");
    const subjects = [...this.subjectById.values()].filter((subject) => {
      if (language && subject.language !== language) return false;
      if (group && subject.group_name !== group) return false;
      return true;
    });
    const editions = edition ? [edition] : (options.editions || []).map((item) => String(item.value));
    const items = [];
    for (const ed of editions) {
      for (const subject of subjects) {
        const key = `${scope === "provincial" ? "P" : "N"}_${provinceId}_${ed}_${subject.subject_id}`;
        if (!index[key]) continue;
        const payload = await this.load(`/data/competitions/${key}.json`);
        for (const row of Array.isArray(payload) ? payload : payload.items || []) {
          items.push({
            edition: Number(ed),
            scopeCode: scope === "provincial" ? 1 : 2,
            provinceId,
            subject,
            row,
          });
        }
      }
    }
    const schoolQ = normalizeClientText(params.get("school"));
    const q = normalizeClientText(params.get("q"));
    let filtered = items;
    if (schoolQ) {
      filtered = filtered.filter((entry) => {
        const schoolItem = this.schoolById.get(Number(entry.row[3])) || {};
        return normalizeClientText(schoolItem.norm || schoolItem.school).includes(schoolQ);
      });
    }
    if (q) {
      const qRows = [];
      for (const entry of filtered) {
        const person = await this.loadPersonByRow(entry.row[1]);
        if (person && normalizeClientText(person.name).includes(q)) qRows.push(entry);
      }
      filtered = qRows;
    }
    filtered.sort((a, b) => this.compareCompetitionEntry(a, b));
    return {
      total: filtered.length,
      items: await Promise.all(paginateItems(filtered, limit, offset).map((entry) => this.decodeCompetitionEntry(entry))),
      limit,
      offset,
    };
  }

  compareCompetitionEntry(a, b) {
    const aRegion = this.regionById.get(Number(a.row[4])) || "";
    const bRegion = this.regionById.get(Number(b.row[4])) || "";
    return (
      Number(b.edition || 0) - Number(a.edition || 0) ||
      String(a.subject.language || "").localeCompare(String(b.subject.language || ""), "zh-CN") ||
      String(a.subject.group_name || "").localeCompare(String(b.subject.group_name || ""), "zh-CN") ||
      Number(a.row[2] || 0) - Number(b.row[2] || 0) ||
      String(aRegion).localeCompare(String(bRegion), "zh-CN")
    );
  }

  async decodeCompetitionEntry(entry) {
    const row = entry.row;
    const person = await this.loadPersonByRow(row[1]);
    const school = this.schoolById.get(Number(row[3])) || {};
    const province = this.provinceById.get(Number(entry.provinceId)) || {};
    return {
      edition: entry.edition,
      contestantId: person?.id || "",
      editionLabel: this.editionLabel(entry.edition),
      stage: this.scopeLabel(entry.scopeCode),
      region: this.regionById.get(Number(row[4])) || "",
      province: province.value || "",
      rank: Number(row[2] || 0),
      school: school.school || person?.school || "",
      schoolNorm: school.norm || person?.schoolNorm || "",
      name: person?.name || "",
      nameNorm: normalizeClientText(person?.name || ""),
      subject: entry.subject.display_name || "",
      language: entry.subject.language || "",
      group: entry.subject.group_name || "",
      award: this.awardLabel(row[5]),
      hasProvincialChampion: Boolean(person?.hasProvincialChampion),
      hasNationalChampion: Boolean(person?.hasNationalChampion),
    };
  }

  async provinceId(province) {
    await this.dictionaries();
    return this.provinceIdByName.get(province) || 0;
  }

  async schools(params, page) {
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const q = normalizeClientText(params.get("q"));
    let items = await this.allSchools();
    if (q) items = items.filter((item) => normalizeClientText(item.school).includes(q));
    return { total: items.length, items: paginateItems(items, limit, offset), limit, offset };
  }

  async contestant(id) {
    await this.dictionaries();
    if (!this.lookupById.has(id)) {
      const prefix = String(id).slice(0, this.manifest.lookupPrefixLength || 2).toLowerCase();
      const entries = await this.load(`/data/person_lookup/${prefix}.json`);
      for (const entry of entries) {
        this.lookupById.set(entry[0], { pid: Number(entry[1]), rowNo: Number(entry[2]) });
      }
    }
    const found = this.lookupById.get(id);
    if (!found) throw new Error("not found");
    const contestant = await this.loadPersonByRow(found.rowNo);
    const detail = await this.load(`/data/details/${detailShardForPid(found.pid)}.json`);
    const entry = Array.isArray(detail)
      ? detail.find((item) => Number(item[0]) === Number(found.pid))
      : detail[id];
    if (Array.isArray(entry)) {
      return { contestant, records: (entry[1] || []).map((record) => this.decodeRecord(record)) };
    }
    if (entry) return entry;
    throw new Error("not found");
  }

  async schoolDetail(school, page) {
    const schools = await this.allSchools();
    const summary = schools.find((item) => item.school === school);
    if (!summary) throw new Error("not found");
    const params = apiParams(new URLSearchParams(), page);
    const limit = Number(params.get("limit") || PAGE_SIZE);
    const offset = Number(params.get("offset") || 0);
    const rows = await this.load(`/data/schools/${summary.sid}.json`);
    return {
      school: summary,
      total: rows.length,
      items: await this.loadRows(paginateItems(rows, limit, offset)),
      limit,
      offset,
    };
  }
}

function setEmpty(wrap, empty, message) {
  empty.textContent = message;
  wrap.classList.add("is-empty");
}

function clearEmpty(wrap) {
  wrap.classList.remove("is-empty");
}

function showOnly(viewName) {
  startupLoading.hidden = true;
  Object.values(views).forEach((view) => {
    view.hidden = true;
  });
  views[viewName].hidden = false;
}

function updateNav(mode) {
  navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.mode === mode);
  });
}

function urlForMode(mode) {
  if (mode === "home") return "/";
  return `/?mode=${encodeURIComponent(mode)}`;
}

function schoolUrl(school) {
  return `/schools/${encodeURIComponent(school)}`;
}

async function loadMeta() {
  try {
    const meta = await dataProvider.meta();
    metaLine.textContent = `${formatInt(meta.contestantCount)} 位选手 · ${formatInt(meta.recordCount)} 条记录`;
    schoolMetaLine.textContent = `${formatInt(meta.schoolCount)} 所学校`;
  } catch {
    metaLine.textContent = "";
    schoolMetaLine.textContent = "";
  }
}

async function loadHome() {
  homeStats.innerHTML = "";
  homeContestants.innerHTML = "<li>加载中</li>";
  homeSchools.innerHTML = "<li>加载中</li>";
  try {
    const payload = await dataProvider.home();
    const meta = payload.meta;
    homeStats.innerHTML = [
      ["选手档案", meta.contestantCount],
      ["获奖记录", meta.recordCount],
      ["覆盖学校", meta.schoolCount],
      ["当前届次", meta.currentEditionLabel || "-"],
    ]
      .map(([label, value]) => `<div class="home-stat"><strong>${typeof value === "number" ? formatInt(value) : value}</strong><span>${label}</span></div>`)
      .join("");
    renderHomeContestants(payload.topContestants || []);
    renderHomeSchools(payload.topSchools || []);
  } catch {
    homeContestants.innerHTML = "<li>加载失败</li>";
    homeSchools.innerHTML = "<li>加载失败</li>";
  }
}

function renderHomeContestants(items) {
  homeContestants.innerHTML = items
    .map((item, index) => `<li>
      <span>${index + 1}.</span>
      <a href="/contestants/${encodeURIComponent(item.id)}" data-person="${escapeHtml(item.id)}">${nameWithBadges(item)}</a>
      <small>${escapeHtml(item.school)} · ${formatInt(item.total)} 项</small>
    </li>`)
    .join("");
}

function renderHomeSchools(items) {
  homeSchools.innerHTML = items
    .map((item, index) => `<li>
      <span>${index + 1}.</span>
      <a href="${schoolUrl(item.school)}" data-school="${escapeHtml(item.school)}">${escapeHtml(item.school)}</a>
      <small>${formatInt(item.total)} 项 · 最高排名 ${escapeHtml(item.bestRank || "-")}</small>
    </li>`)
    .join("");
}

async function loadCompetitionOptions() {
  const options = await dataProvider.competitionOptions();
  competitionOptions = options || { languages: [], groups: [], subjectsByEdition: {} };
  fillSelect(scopeSelect, "省赛 / 国赛", options.scopes || [], true);
  fillSelect(editionSelect, "全部届次", options.editions || [], true);
  syncSubjectControls();
  provinceOptions = options.provinces || [];
  syncProvinceControl();
}

function fillSelect(select, emptyLabel, values, objectValues = false) {
  select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>`;
  for (const item of values) {
    const value = objectValues ? item.value : item;
    const label = objectValues ? item.label : item;
    select.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`);
  }
}

function syncSubjectControls() {
  const editionSubjects = editionSelect.value ? competitionOptions.subjectsByEdition?.[editionSelect.value] : null;
  const languages = editionSubjects ? editionSubjects.languages || [] : competitionOptions.languages || [];
  const groups = editionSubjects ? editionSubjects.groups || [] : competitionOptions.groups || [];
  const languageValue = languageSelect.value;
  const groupValue = groupSelect.value;
  fillSelect(languageSelect, "全部语言", languages);
  fillSelect(groupSelect, "全部组别", groups);
  if (languages.includes(languageValue)) {
    languageSelect.value = languageValue;
  }
  if (groups.includes(groupValue)) {
    groupSelect.value = groupValue;
  }
}

function renderProvinceMenu() {
  if (provinceCombo.dataset.disabled === "true") {
    provinceMenu.hidden = true;
    return;
  }
  const query = provinceSearch.value;
  const matches = provinceOptions
    .map((option) => ({ option, score: provinceScore(option, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.option.total || 0) - Number(a.option.total || 0) || a.option.label.localeCompare(b.option.label, "zh-CN"))
    .slice(0, 20);
  if (!matches.length) {
    provinceMenu.innerHTML = `<div class="combo-empty">没有匹配省份</div>`;
    provinceMenu.hidden = false;
    return;
  }
  provinceMenu.innerHTML = matches
    .map(({ option }) => `<button class="combo-option" type="button" data-value="${escapeHtml(option.value)}">
      <span>${escapeHtml(option.label)}</span>
      <small>${formatInt(option.total)} 条</small>
    </button>`)
    .join("");
  provinceMenu.hidden = false;
}

function selectProvince(value, pushSearch = true) {
  const option = provinceOptions.find((item) => item.value === value);
  provinceValue.value = option ? option.value : "";
  provinceSearch.value = option ? option.label : "";
  provinceMenu.hidden = true;
  provinceSearch.classList.toggle("is-invalid", scopeSelect.value === "provincial" && !provinceValue.value);
  if (pushSearch) {
    resetPage("competition");
    runCompetitionSearch();
  }
}

function clearProvince() {
  provinceValue.value = "";
  provinceSearch.value = "";
  provinceMenu.hidden = true;
}

function syncProvinceControl() {
  const isProvincial = scopeSelect.value === "provincial";
  provinceCombo.dataset.disabled = isProvincial ? "false" : "true";
  provinceSearch.disabled = !isProvincial;
  provinceSearch.placeholder = isProvincial ? "省份：输入中文 / 拼音 / 首字母" : scopeSelect.value ? "国赛无需选择省份" : "先选择省赛";
  if (!isProvincial) {
    clearProvince();
    provinceSearch.classList.remove("is-invalid");
  }
}

function navigate(mode, push = true) {
  state.mode = mode;
  updateNav(mode);
  hideOtherSearchPagination(mode);
  if (mode === "home") {
    showOnly("home");
    loadHome();
  } else if (mode === "school") {
    showOnly("school");
    runSchoolSearch(false);
  } else {
    showOnly("search");
    const isCompetition = mode === "competition";
    personControls.hidden = isCompetition;
    personTableWrap.hidden = isCompetition;
    competitionControls.hidden = !isCompetition;
    competitionTableWrap.hidden = !isCompetition;
    if (isCompetition) {
      runCompetitionSearch(false);
    } else {
      runSearch(false);
    }
  }
  if (push) {
    history.pushState({ view: "main", mode }, "", urlForMode(mode));
  }
}

async function runSearch(push = true) {
  state.mode = "person";
  state.q = qInput.value.trim();
  state.school = schoolInput.value.trim();
  syncSearchInputKey("person");
  const page = currentPage("person");
  const params = new URLSearchParams();
  params.set("mode", "person");
  if (state.q) params.set("q", state.q);
  if (state.school) params.set("school", state.school);
  addPageToUrl(params, page);
  const requestKey = searchRequestKey("person", params, page);
  if (isRepeatedSearchRequest("person", requestKey)) return;
  if (!reserveQuerySlot()) {
    setEmpty(personTableWrap, emptyState, "请求太频繁，请稍后再试");
    hidePagination("person");
    return;
  }
  markSearchRequestStarted("person", requestKey);
  resultsBody.innerHTML = "";
  setEmpty(personTableWrap, emptyState, "加载中");
  hidePagination("person");
  let completed = false;
  try {
    const payload = await dataProvider.search(apiParams(params, page), page);
    if (!ensurePageInRange("person", payload.total, runSearch)) return;
    renderResults(payload.items || [], (page - 1) * PAGE_SIZE);
    updatePagination("person", payload.total);
    if (push) {
      history.pushState({ view: "main", mode: "person" }, "", `/?${params.toString()}`);
    }
    completed = true;
  } catch (error) {
    setEmpty(personTableWrap, emptyState, error.status === 429 ? "请求太频繁，请稍后再试" : "查询失败");
    hidePagination("person");
  } finally {
    markSearchRequestFinished("person", requestKey, completed);
  }
}

function renderResults(items, offset = 0) {
  resultsBody.innerHTML = "";
  if (!items.length) {
    setEmpty(personTableWrap, emptyState, "没有匹配结果");
    return;
  }
  clearEmpty(personTableWrap);
  resultsBody.innerHTML = items
    .map((item, index) => {
      const cells = columns.map(([key]) => `<td>${Number(item[key] || 0)}</td>`).join("");
      return `<tr>
        <td>${offset + index + 1}</td>
        <td><a href="/contestants/${encodeURIComponent(item.id)}" data-person="${escapeHtml(item.id)}">${nameWithBadges(item)}</a></td>
        <td>${escapeHtml(item.school)}</td>
        ${cells}
      </tr>`;
    })
    .join("");
}

async function runCompetitionSearch(push = true) {
  state.mode = "competition";
  syncSearchInputKey("competition");
  const page = currentPage("competition");
  const params = new URLSearchParams();
  params.set("mode", "competition");
  if (scopeSelect.value) params.set("scope", scopeSelect.value);
  if (scopeSelect.value === "provincial" && provinceValue.value) params.set("province", provinceValue.value);
  if (editionSelect.value) params.set("edition", editionSelect.value);
  if (languageSelect.value) params.set("language", languageSelect.value);
  if (groupSelect.value) params.set("group", groupSelect.value);
  if (competitionSchool.value.trim()) params.set("school", competitionSchool.value.trim());
  if (competitionKeyword.value.trim()) params.set("q", competitionKeyword.value.trim());
  addPageToUrl(params, page);
  competitionBody.innerHTML = "";
  const validationMessage = competitionValidationMessage();
  if (validationMessage) {
    setEmpty(competitionTableWrap, competitionEmpty, validationMessage);
    hidePagination("competition");
    if (push) {
      history.pushState({ view: "main", mode: "competition" }, "", `/?${params.toString()}`);
    }
    return;
  }
  if (!reserveQuerySlot()) {
    setEmpty(competitionTableWrap, competitionEmpty, "请求太频繁，请稍后再试");
    hidePagination("competition");
    return;
  }
  setEmpty(competitionTableWrap, competitionEmpty, "加载中");
  hidePagination("competition");
  try {
    const payload = await dataProvider.competition(apiParams(params, page), page);
    if (!ensurePageInRange("competition", payload.total, runCompetitionSearch)) return;
    renderCompetition(payload.items || []);
    updatePagination("competition", payload.total);
    if (push) {
      history.pushState({ view: "main", mode: "competition" }, "", `/?${params.toString()}`);
    }
  } catch (error) {
    setEmpty(competitionTableWrap, competitionEmpty, error.status === 429 ? "请求太频繁，请稍后再试" : "查询失败");
    hidePagination("competition");
  }
}

function competitionValidationMessage() {
  scopeSelect.classList.toggle("is-invalid", !scopeSelect.value);
  provinceSearch.classList.toggle("is-invalid", scopeSelect.value === "provincial" && !provinceValue.value);
  if (!scopeSelect.value) {
    return "请先选择省赛或国赛";
  }
  if (scopeSelect.value === "provincial" && !provinceValue.value) {
    return "查询省赛名单时必须先选择省份";
  }
  return "";
}

function renderCompetition(items) {
  competitionBody.innerHTML = "";
  if (!items.length) {
    setEmpty(competitionTableWrap, competitionEmpty, "没有匹配结果");
    return;
  }
  clearEmpty(competitionTableWrap);
  competitionBody.innerHTML = items
    .map((item) => `<tr>
      <td>${escapeHtml(item.editionLabel)}</td>
      <td>${escapeHtml(item.stage)}</td>
      <td>${escapeHtml(item.region || item.province)}</td>
      <td>${Number(item.rank || 0)}</td>
      <td><a href="${schoolUrl(item.school)}" data-school="${escapeHtml(item.school)}">${escapeHtml(item.school)}</a></td>
      <td><a href="/contestants/${encodeURIComponent(item.contestantId)}" data-person="${escapeHtml(item.contestantId)}">${nameWithBadges(item)}</a></td>
      <td>${escapeHtml(item.subject)}</td>
      <td>${escapeHtml(item.award)}</td>
    </tr>`)
    .join("");
}

async function runSchoolSearch(push = true) {
  state.mode = "school";
  const page = currentPage("school");
  const params = new URLSearchParams();
  params.set("mode", "school");
  const q = schoolRankInput.value.trim();
  syncSearchInputKey("school");
  if (q) params.set("q", q);
  addPageToUrl(params, page);
  const requestKey = searchRequestKey("school", params, page);
  if (isRepeatedSearchRequest("school", requestKey)) return;
  markSearchRequestStarted("school", requestKey);
  schoolBody.innerHTML = "";
  setEmpty(schoolTableWrap, schoolEmpty, "加载中");
  hidePagination("school");
  let completed = false;
  try {
    const payload = await dataProvider.schools(apiParams(params, page), page);
    if (!ensurePageInRange("school", payload.total, runSchoolSearch)) return;
    renderSchools(payload.items || [], (page - 1) * PAGE_SIZE);
    updatePagination("school", payload.total);
    if (push) {
      history.pushState({ view: "main", mode: "school" }, "", `/?${params.toString()}`);
    }
    completed = true;
  } catch {
    setEmpty(schoolTableWrap, schoolEmpty, "查询失败");
    hidePagination("school");
  } finally {
    markSearchRequestFinished("school", requestKey, completed);
  }
}

function renderSchools(items, offset = 0) {
  schoolBody.innerHTML = "";
  if (!items.length) {
    setEmpty(schoolTableWrap, schoolEmpty, "没有匹配结果");
    return;
  }
  clearEmpty(schoolTableWrap);
  schoolBody.innerHTML = items
    .map((item, index) => {
      const cells = columns.map(([key]) => `<td>${Number(item[key] || 0)}</td>`).join("");
      return `<tr>
        <td>${offset + index + 1}</td>
        <td><a href="${schoolUrl(item.school)}" data-school="${escapeHtml(item.school)}">${escapeHtml(item.school)}</a></td>
        <td>${escapeHtml(item.bestRank || "-")}</td>
        ${cells}
      </tr>`;
    })
    .join("");
}

async function showDetail(id, push = true) {
  updateNav("person");
  showOnly("detail");
  document.querySelector("#detail-name").textContent = "";
  document.querySelector("#detail-school").textContent = "";
  document.querySelector("#detail-stats").innerHTML = "";
  document.querySelector("#detail-body").innerHTML = "";
  try {
    const payload = await dataProvider.contestant(id);
    renderDetail(payload);
    if (push) {
      history.pushState({ view: "detail", id }, "", `/contestants/${encodeURIComponent(id)}`);
    }
  } catch {
    document.querySelector("#detail-name").textContent = "未找到";
  }
}

function renderDetail(payload) {
  const person = payload.contestant;
  document.querySelector("#detail-name").innerHTML = nameWithBadges(person);
  document.querySelector("#detail-school").textContent = person.school;
  document.querySelector("#detail-stats").innerHTML = columns
    .map(([key, label]) => `<div class="stat-cell"><div><strong>${Number(person[key] || 0)}</strong><span>${label}</span></div></div>`)
    .join("");
  document.querySelector("#detail-body").innerHTML = payload.records
    .map((record) => `<tr>
      <td>${escapeHtml(record.editionLabel)}</td>
      <td>${escapeHtml(record.stage)}</td>
      <td>${escapeHtml(record.region || record.province)}</td>
      <td>${Number(record.rank || 0)}</td>
      <td>${escapeHtml(record.subject)}</td>
      <td>${escapeHtml(record.award)}</td>
    </tr>`)
    .join("");
}

async function showSchoolDetail(school, push = true) {
  state.currentSchool = school;
  updateNav("school");
  showOnly("schoolDetail");
  hideOtherSearchPagination("schoolDetail");
  schoolDetailName.textContent = school;
  schoolDetailMeta.textContent = "";
  schoolDetailStats.innerHTML = "";
  schoolDetailBody.innerHTML = "";
  setEmpty(schoolDetailTableWrap, schoolDetailEmpty, "加载中");
  hidePagination("schoolDetail");
  const page = currentPage("schoolDetail");
  try {
    const payload = await dataProvider.schoolDetail(school, page);
    if (!ensurePageInRange("schoolDetail", payload.total, () => showSchoolDetail(school, false))) return;
    renderSchoolDetail(payload, (page - 1) * PAGE_SIZE);
    updatePagination("schoolDetail", payload.total);
    if (push) {
      const url = schoolUrl(payload.school.school);
      history.pushState({ view: "schoolDetail", school: payload.school.school }, "", page > 1 ? `${url}?page=${page}` : url);
    }
  } catch {
    schoolDetailName.textContent = "未找到";
    setEmpty(schoolDetailTableWrap, schoolDetailEmpty, "没有找到这所学校");
    hidePagination("schoolDetail");
  }
}

function renderSchoolDetail(payload, offset = 0) {
  const school = payload.school;
  schoolDetailName.textContent = school.school;
  schoolDetailMeta.textContent = `${formatInt(school.contestantCount)} 位选手 · ${formatInt(school.recordCount)} 条记录 · 最高排名 ${school.bestRank || "-"}`;
  schoolDetailStats.innerHTML = columns
    .map(([key, label]) => `<div class="stat-cell"><div><strong>${Number(school[key] || 0)}</strong><span>${label}</span></div></div>`)
    .join("");
  if (!payload.items.length) {
    setEmpty(schoolDetailTableWrap, schoolDetailEmpty, "暂无选手数据");
    return;
  }
  clearEmpty(schoolDetailTableWrap);
  schoolDetailBody.innerHTML = payload.items
    .map((item, index) => {
      const cells = columns.map(([key]) => `<td>${Number(item[key] || 0)}</td>`).join("");
      return `<tr>
        <td>${offset + index + 1}</td>
        <td><a href="/contestants/${encodeURIComponent(item.id)}" data-person="${escapeHtml(item.id)}">${nameWithBadges(item)}</a></td>
        ${cells}
      </tr>`;
    })
    .join("");
}

function scheduleCurrentSearch() {
  if (!views.detail.hidden || !views.schoolDetail.hidden) return;
  const inputKey = currentSearchInputKey(state.mode);
  if (hasSearchInputKey(state.mode) && inputKey === lastSearchInputKeys[state.mode]) return;
  syncSearchInputKey(state.mode);
  resetPage(state.mode);
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    if (state.mode === "competition") {
      runCompetitionSearch(false);
    } else if (state.mode === "school") {
      runSchoolSearch(false);
    } else if (state.mode === "person") {
      runSearch(false);
    }
  }, QUERY_INTERVAL_MS);
}

function reserveQuerySlot() {
  const now = Date.now();
  recentQueryTimes = recentQueryTimes.filter((seenAt) => now - seenAt < QUERY_RATE_WINDOW_MS);
  if (recentQueryTimes.length >= QUERY_RATE_MAX_REQUESTS) {
    return false;
  }
  recentQueryTimes.push(now);
  return true;
}

function hydrateFromUrl() {
  const path = window.location.pathname;
  if (path.startsWith("/contestants/")) {
    showDetail(decodeURIComponent(path.split("/").pop()), false);
    return;
  }
  if (path.startsWith("/schools/")) {
    state.schoolDetailPage = parsePage(new URLSearchParams(window.location.search).get("page"));
    showSchoolDetail(decodeURIComponent(path.split("/").pop()), false);
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const mode = ["home", "competition", "person", "school"].includes(params.get("mode")) ? params.get("mode") : "home";
  const page = parsePage(params.get("page"));
  state.personPage = mode === "person" ? page : 1;
  state.competitionPage = mode === "competition" ? page : 1;
  state.schoolPage = mode === "school" ? page : 1;
  qInput.value = params.get("q") || "";
  schoolInput.value = params.get("school") || "";
  scopeSelect.value = params.get("scope") || "";
  syncProvinceControl();
  if (scopeSelect.value === "provincial") {
    selectProvince(params.get("province") || "", false);
  }
  editionSelect.value = params.get("edition") || "";
  syncSubjectControls();
  languageSelect.value = params.get("language") || "";
  groupSelect.value = params.get("group") || "";
  competitionSchool.value = params.get("school") || "";
  competitionKeyword.value = mode === "competition" ? params.get("q") || "" : "";
  schoolRankInput.value = mode === "school" ? params.get("q") || "" : "";
  navigate(mode, false);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (state.mode === "competition") {
    resetPage("competition");
    runCompetitionSearch();
  } else {
    resetPage("person");
    runSearch();
  }
});

schoolForm.addEventListener("submit", (event) => {
  event.preventDefault();
  resetPage("school");
  runSchoolSearch();
});

navLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    resetPage(link.dataset.mode);
    navigate(link.dataset.mode);
  });
});

jumpButtons.forEach((button) => {
  button.addEventListener("click", () => {
    resetPage(button.dataset.jump);
    navigate(button.dataset.jump);
  });
});

homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  navigate("home");
});

qInput.addEventListener("input", scheduleCurrentSearch);
schoolInput.addEventListener("input", scheduleCurrentSearch);
scopeSelect.addEventListener("change", () => {
  resetPage("competition");
  syncProvinceControl();
  runCompetitionSearch();
});
provinceSearch.addEventListener("input", () => {
  provinceValue.value = "";
  provinceSearch.classList.remove("is-invalid");
  renderProvinceMenu();
});
provinceSearch.addEventListener("focus", renderProvinceMenu);
provinceSearch.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (!provinceValue.value) {
      provinceSearch.value = "";
    }
    provinceMenu.hidden = true;
    competitionValidationMessage();
  }, 120);
});
provinceMenu.addEventListener("mousedown", (event) => {
  event.preventDefault();
});
provinceMenu.addEventListener("click", (event) => {
  const option = event.target.closest(".combo-option");
  if (!option) return;
  selectProvince(option.dataset.value);
});
competitionSchool.addEventListener("input", scheduleCurrentSearch);
competitionKeyword.addEventListener("input", scheduleCurrentSearch);
schoolRankInput.addEventListener("input", scheduleCurrentSearch);
editionSelect.addEventListener("change", () => {
  resetPage("competition");
  syncSubjectControls();
  runCompetitionSearch();
});
languageSelect.addEventListener("change", () => {
  resetPage("competition");
  runCompetitionSearch();
});
groupSelect.addEventListener("change", () => {
  resetPage("competition");
  runCompetitionSearch();
});
competitionSubmit.addEventListener("click", () => {
  resetPage("competition");
  runCompetitionSearch();
});

document.addEventListener("click", (event) => {
  const personLink = event.target.closest("a[data-person]");
  if (personLink) {
    event.preventDefault();
    showDetail(personLink.dataset.person);
    return;
  }
  const schoolLink = event.target.closest("a[data-school-jump]");
  if (schoolLink) {
    event.preventDefault();
    schoolRankInput.value = schoolLink.dataset.schoolJump;
    resetPage("school");
    navigate("school");
    return;
  }
  const schoolDetailLink = event.target.closest("a[data-school]");
  if (schoolDetailLink) {
    event.preventDefault();
    resetPage("schoolDetail");
    showSchoolDetail(schoolDetailLink.dataset.school);
  }
});

backButton.addEventListener("click", () => navigate(state.mode === "home" ? "person" : state.mode));
schoolBackButton.addEventListener("click", () => navigate("school"));

window.addEventListener("popstate", hydrateFromUrl);

async function init() {
  bindPager("person");
  bindPager("competition");
  bindPager("school");
  bindPager("schoolDetail");
  try {
    dataProvider = await createDataProvider();
    await Promise.all([loadMeta(), loadCompetitionOptions()]);
  } catch {
    competitionOptions = { languages: [], groups: [], subjectsByEdition: {} };
    provinceOptions = [];
    fillSelect(scopeSelect, "省赛 / 国赛", [], true);
    fillSelect(editionSelect, "全部届次", [], true);
    fillSelect(languageSelect, "全部语言", []);
    fillSelect(groupSelect, "全部组别", []);
    syncProvinceControl();
  } finally {
    hydrateFromUrl();
  }
}

init();
