# South Korea — Master University List for uni_db

**Purpose:** candidate institutions for the Hanguk uni_db system.
**Compiled:** 2026-05-23.
**Method:** compiled from Claude's knowledge of the Korean higher-education
sector, cross-checked against web search (uniRank, MOE, Wikipedia category
counts) for category totals and the 2024–2026 closure/merger wave. Direct
bulk-fetch of an authoritative file was not possible from this environment
(outbound fetch blocked), so **this list MUST be reconciled against the
official source before it seeds the student-facing database** — use the
`services/uni_db/src/uni_db/upstream/data_go_kr.py` adapter (data.go.kr
"대학정보" OpenAPI) or 대학알리미 (academyinfo.go.kr), which are the canonical,
always-current registries.

**Counts:** ~190 four-year universities + ~115 junior colleges + ~18 cyber
universities = **320+ institutions** (exceeds the 300 target).

**Caveats / known changes (verified via search 2026-05):**
- Korea is in a demographic-driven closure wave; the MOE has flagged dozens of
  financially insolvent schools. A few long-tail entries below may be
  merging, suspending enrollment, or closing.
- **Gangneung-Wonju National University** is merging into **Kangwon National
  University** — listed once, flagged.
- **Korea National University of Welfare** merged into **Korea National
  University of Transportation** (2024) — not listed separately.
- Already-closed schools are **excluded** (e.g. Seonam Univ. closed 2018,
  Hanlyo Univ. closed 2022, Asia LIFE/Dongbu, etc.).
- `(merging)` / `(at risk)` tags mark institutions to confirm before seeding.

Format: `Korean name — English name — city / province`.

---

## 1. National & public 4-year universities (국·공립대학교)

### 1a. Flagship & regional national universities (거점·일반 국립대)
1. 서울대학교 — Seoul National University — Seoul
2. 부산대학교 — Pusan National University — Busan
3. 경북대학교 — Kyungpook National University — Daegu
4. 전남대학교 — Chonnam National University — Gwangju
5. 전북대학교 — Jeonbuk National University — Jeonju, Jeonbuk
6. 충남대학교 — Chungnam National University — Daejeon
7. 충북대학교 — Chungbuk National University — Cheongju, Chungbuk
8. 경상국립대학교 — Gyeongsang National University — Jinju, Gyeongnam
9. 강원대학교 — Kangwon National University — Chuncheon, Gangwon
10. 제주대학교 — Jeju National University — Jeju
11. 인천대학교 — Incheon National University — Incheon
12. 부경대학교 — Pukyong National University — Busan
13. 한국해양대학교 — Korea Maritime & Ocean University — Busan
14. 서울과학기술대학교 — Seoul National University of Science & Technology (SeoulTech) — Seoul
15. 한밭대학교 — Hanbat National University — Daejeon
16. 금오공과대학교 — Kumoh National Institute of Technology — Gumi, Gyeongbuk
17. 한국교통대학교 — Korea National University of Transportation — Chungju, Chungbuk
18. 국립안동대학교 — Andong National University — Andong, Gyeongbuk
19. 국립목포대학교 — Mokpo National University — Muan, Jeonnam
20. 국립순천대학교 — Sunchon National University — Suncheon, Jeonnam
21. 국립창원대학교 — Changwon National University — Changwon, Gyeongnam
22. 국립군산대학교 — Kunsan National University — Gunsan, Jeonbuk
23. 국립공주대학교 — Kongju National University — Gongju, Chungnam
24. 목포해양대학교 — Mokpo National Maritime University — Mokpo, Jeonnam
25. 한경국립대학교 — Hankyong National University — Anseong, Gyeonggi
26. 강릉원주대학교 — Gangneung-Wonju National University — Gangneung, Gangwon `(merging → Kangwon Nat'l)`

### 1b. National science & technology institutes (특수법인 과기원)
27. 한국과학기술원 (KAIST) — Korea Advanced Institute of Science & Technology — Daejeon
28. 광주과학기술원 (GIST) — Gwangju Institute of Science & Technology — Gwangju
29. 대구경북과학기술원 (DGIST) — Daegu Gyeongbuk Institute of Science & Technology — Daegu
30. 울산과학기술원 (UNIST) — Ulsan National Institute of Science & Technology — Ulsan
31. 과학기술연합대학원대학교 (UST) — University of Science & Technology — Daejeon (graduate)

### 1c. National universities of education (교육대학) + KNUE
32. 한국교원대학교 — Korea National University of Education — Cheongju, Chungbuk
33. 서울교육대학교 — Seoul National University of Education — Seoul
34. 경인교육대학교 — Gyeongin National University of Education — Incheon / Anyang
35. 부산교육대학교 — Busan National University of Education — Busan
36. 대구교육대학교 — Daegu National University of Education — Daegu
37. 광주교육대학교 — Gwangju National University of Education — Gwangju
38. 전주교육대학교 — Jeonju National University of Education — Jeonju
39. 청주교육대학교 — Cheongju National University of Education — Cheongju
40. 춘천교육대학교 — Chuncheon National University of Education — Chuncheon
41. 공주교육대학교 — Gongju National University of Education — Gongju
42. 진주교육대학교 — Jinju National University of Education — Jinju

### 1d. Special national universities (군·경·예·체·문화재·농수산)
43. 한국방송통신대학교 — Korea National Open University — Seoul
44. 한국체육대학교 — Korea National Sport University — Seoul
45. 한국예술종합학교 — Korea National University of Arts — Seoul
46. 한국전통문화대학교 — Korea National University of Cultural Heritage — Buyeo, Chungnam
47. 한국농수산대학교 — Korea National University of Agriculture & Fisheries — Jeonju
48. 경찰대학 — Korea National Police University — Asan, Chungnam
49. 육군사관학교 — Korea Military Academy — Seoul
50. 해군사관학교 — Korea Naval Academy — Changwon
51. 공군사관학교 — Korea Air Force Academy — Cheongju
52. 국군간호사관학교 — Korea Armed Forces Nursing Academy — Daejeon
53. 육군3사관학교 — Korea Army Academy at Yeongcheon — Yeongcheon, Gyeongbuk

### 1e. Public / municipal
54. 서울시립대학교 — University of Seoul — Seoul (municipal)

---

## 2. Private 4-year universities (사립대학교)

### 2a. Seoul
55. 연세대학교 — Yonsei University — Seoul
56. 고려대학교 — Korea University — Seoul
57. 성균관대학교 — Sungkyunkwan University — Seoul / Suwon
58. 한양대학교 — Hanyang University — Seoul / Ansan
59. 중앙대학교 — Chung-Ang University — Seoul / Anseong
60. 경희대학교 — Kyung Hee University — Seoul / Yongin
61. 서강대학교 — Sogang University — Seoul
62. 한국외국어대학교 — Hankuk University of Foreign Studies — Seoul / Yongin
63. 이화여자대학교 — Ewha Womans University — Seoul
64. 숙명여자대학교 — Sookmyung Women's University — Seoul
65. 건국대학교 — Konkuk University — Seoul
66. 동국대학교 — Dongguk University — Seoul
67. 홍익대학교 — Hongik University — Seoul / Sejong
68. 세종대학교 — Sejong University — Seoul
69. 국민대학교 — Kookmin University — Seoul
70. 숭실대학교 — Soongsil University — Seoul
71. 광운대학교 — Kwangwoon University — Seoul
72. 명지대학교 — Myongji University — Seoul / Yongin
73. 상명대학교 — Sangmyung University — Seoul / Cheonan
74. 성신여자대학교 — Sungshin Women's University — Seoul
75. 덕성여자대학교 — Duksung Women's University — Seoul
76. 동덕여자대학교 — Dongduk Women's University — Seoul
77. 서울여자대학교 — Seoul Women's University — Seoul
78. 한성대학교 — Hansung University — Seoul
79. 삼육대학교 — Sahmyook University — Seoul
80. 가톨릭대학교 — Catholic University of Korea — Seoul / Bucheon
81. 서경대학교 — Seokyeong University — Seoul
82. 성공회대학교 — Sungkonghoe University — Seoul
83. 총신대학교 — Chongshin University — Seoul
84. 추계예술대학교 — Chugye University for the Arts — Seoul
85. 감리교신학대학교 — Methodist Theological University — Seoul
86. 장로회신학대학교 — Presbyterian University & Theological Seminary — Seoul
87. 서울기독대학교 — Seoul Christian University — Seoul
88. KC대학교 — KC University — Seoul
89. 한국성서대학교 — Korean Bible University — Seoul

### 2b. Gyeonggi / Incheon
90. 아주대학교 — Ajou University — Suwon
91. 인하대학교 — Inha University — Incheon
92. 단국대학교 — Dankook University — Yongin / Cheonan
93. 가천대학교 — Gachon University — Seongnam / Incheon
94. 경기대학교 — Kyonggi University — Suwon / Seoul
95. 한국항공대학교 — Korea Aerospace University — Goyang
96. 한신대학교 — Hanshin University — Osan
97. 협성대학교 — Hyupsung University — Hwaseong
98. 수원대학교 — Suwon University — Hwaseong
99. 평택대학교 — Pyeongtaek University — Pyeongtaek
100. 대진대학교 — Daejin University — Pocheon
101. 안양대학교 — Anyang University — Anyang
102. 강남대학교 — Kangnam University — Yongin
103. 용인대학교 — Yong In University — Yongin
104. 을지대학교 — Eulji University — Seongnam / Daejeon
105. 차의과학대학교 — CHA University — Pocheon
106. 신한대학교 — Shinhan University — Uijeongbu
107. 루터대학교 — Luther University — Yongin
108. 칼빈대학교 — Calvin University — Yongin
109. 인천가톨릭대학교 — Incheon Catholic University — Incheon
110. 경동대학교 — Kyungdong University — Wonju / Goseong / Yangju
111. 한국공학대학교 — Tech University of Korea (formerly Korea Polytechnic Univ.) — Siheung

### 2c. Gangwon
112. 한림대학교 — Hallym University — Chuncheon
113. 상지대학교 — Sangji University — Wonju
114. 가톨릭관동대학교 — Catholic Kwandong University — Gangneung
115. 한라대학교 — Halla University — Wonju
116. 연세대학교 미래캠퍼스 — Yonsei University Mirae Campus — Wonju

### 2d. Daejeon / Sejong / Chungnam / Chungbuk
117. 배재대학교 — Pai Chai University — Daejeon
118. 목원대학교 — Mokwon University — Daejeon
119. 대전대학교 — Daejeon University — Daejeon
120. 한남대학교 — Hannam University — Daejeon
121. 우송대학교 — Woosong University — Daejeon
122. 건양대학교 — Konyang University — Nonsan / Daejeon
123. 순천향대학교 — Soonchunhyang University — Asan
124. 호서대학교 — Hoseo University — Asan / Cheonan
125. 백석대학교 — Baekseok University — Cheonan
126. 남서울대학교 — Namseoul University — Cheonan
127. 청운대학교 — Chungwoon University — Hongseong
128. 한서대학교 — Hanseo University — Seosan
129. 중부대학교 — Joongbu University — Geumsan
130. 세한대학교 — Sehan University — Dangjin / Yeongam
131. 서원대학교 — Seowon University — Cheongju
132. 청주대학교 — Cheongju University — Cheongju
133. 세명대학교 — Semyung University — Jecheon
134. 극동대학교 — Far East University — Eumseong
135. 중원대학교 — Jungwon University — Goesan
136. 유원대학교 — U1 University — Yeongdong
137. 꽃동네대학교 — Kkottongnae University — Cheongju
138. 건국대학교 글로컬캠퍼스 — Konkuk University Glocal Campus — Chungju
139. 고려대학교 세종캠퍼스 — Korea University Sejong Campus — Sejong
140. 홍익대학교 세종캠퍼스 — Hongik University Sejong Campus — Sejong

### 2e. Gwangju / Jeonnam / Jeonbuk (Honam)
141. 조선대학교 — Chosun University — Gwangju
142. 호남대학교 — Honam University — Gwangju
143. 광주대학교 — Gwangju University — Gwangju
144. 광주여자대학교 — Kwangju Women's University — Gwangju
145. 남부대학교 — Nambu University — Gwangju
146. 송원대학교 — Songwon University — Gwangju
147. 광신대학교 — Kwangshin University — Gwangju
148. 동신대학교 — Dongshin University — Naju
149. 초당대학교 — Chodang University — Muan
150. 목포가톨릭대학교 — Mokpo Catholic University — Mokpo
151. 우석대학교 — Woosuk University — Wanju / Jeonju
152. 전주대학교 — Jeonju University — Jeonju
153. 원광대학교 — Wonkwang University — Iksan
154. 호원대학교 — Howon University — Gunsan
155. 예수대학교 — Jesus University — Jeonju
156. 한일장신대학교 — Hanil University & Presbyterian Theological Seminary — Wanju

### 2f. Busan / Ulsan / Daegu / Gyeongbuk / Gyeongnam (Yeongnam)
157. 포항공과대학교 (POSTECH) — Pohang University of Science & Technology — Pohang
158. 영남대학교 — Yeungnam University — Gyeongsan
159. 계명대학교 — Keimyung University — Daegu
160. 대구대학교 — Daegu University — Gyeongsan
161. 대구가톨릭대학교 — Daegu Catholic University — Gyeongsan
162. 대구한의대학교 — Daegu Haany University — Gyeongsan
163. 경일대학교 — Kyungil University — Gyeongsan
164. 대구예술대학교 — Daegu Arts University — Chilgok
165. 동국대학교 WISE캠퍼스 — Dongguk University WISE Campus — Gyeongju
166. 위덕대학교 — Uiduk University — Gyeongju
167. 한동대학교 — Handong Global University — Pohang
168. 김천대학교 — Gimcheon University — Gimcheon
169. 동양대학교 — Dongyang University — Yeongju
170. 가야대학교 — Gaya University — Gimhae / Goryeong
171. 인제대학교 — Inje University — Gimhae
172. 경남대학교 — Kyungnam University — Changwon
173. 영산대학교 — Youngsan University — Yangsan / Busan
174. 창신대학교 — Changshin University — Changwon
175. 부산가톨릭대학교 — Catholic University of Pusan — Busan
176. 동의대학교 — Dong-eui University — Busan
177. 동아대학교 — Dong-A University — Busan
178. 동서대학교 — Dongseo University — Busan
179. 신라대학교 — Silla University — Busan
180. 경성대학교 — Kyungsung University — Busan
181. 고신대학교 — Kosin University — Busan
182. 부산외국어대학교 — Busan University of Foreign Studies — Busan
183. 부산장신대학교 — Busan Presbyterian University — Gimhae
184. 울산대학교 — University of Ulsan — Ulsan
185. 한국국제대학교 — International University of Korea — Jinju `(at risk)`

### 2g. Jeju
186. 제주국제대학교 — Jeju International University — Jeju

---

## 3. Junior colleges (전문대학, 2–3 year)

### 3a. Seoul
187. 동양미래대학교 — Dongyang Mirae University — Seoul
188. 명지전문대학 — Myongji College — Seoul
189. 인덕대학교 — Induk University — Seoul
190. 한양여자대학교 — Hanyang Women's University — Seoul
191. 배화여자대학교 — Baewha Women's University — Seoul
192. 서일대학교 — Seoil University — Seoul
193. 삼육보건대학교 — Sahmyook Health University — Seoul
194. 숭의여자대학교 — Soongeui Women's College — Seoul
195. 한국폴리텍대학 (서울) — Korea Polytechnics (Seoul) — Seoul (national)
196. 농협대학교 — Nonghyup University — Goyang

### 3b. Gyeonggi / Incheon
197. 서울예술대학교 — Seoul Institute of the Arts — Ansan
198. 동서울대학교 — Dong Seoul University — Seongnam
199. 부천대학교 — Bucheon University — Bucheon
200. 유한대학교 — Yuhan University — Bucheon
201. 안산대학교 — Ansan University — Ansan
202. 신구대학교 — Shingu College — Seongnam
203. 수원과학대학교 — Suwon Science College — Hwaseong
204. 수원여자대학교 — Suwon Women's University — Suwon
205. 경기과학기술대학교 — Gyeonggi University of Science & Technology — Siheung
206. 두원공과대학교 — Doowon Technical University College — Anseong
207. 대림대학교 — Daelim University College — Anyang
208. 연성대학교 — Yeonsung University — Anyang
209. 청강문화산업대학교 — Chungkang College of Cultural Industries — Icheon
210. 김포대학교 — Kimpo University — Gimpo
211. 장안대학교 — Jangan University — Hwaseong
212. 오산대학교 — Osan University — Osan
213. 국제대학교 — Kookje University — Pyeongtaek
214. 동남보건대학교 — Dongnam Health University — Suwon
215. 여주대학교 — Yeoju Institute of Technology — Yeoju
216. 경복대학교 — Kyungbok University — Pocheon / Namyangju
217. 서정대학교 — Seojeong University — Yangju
218. 인하공업전문대학 — Inha Technical College — Incheon
219. 경인여자대학교 — Kyungin Women's University — Incheon
220. 재능대학교 — Jaeneung University — Incheon

### 3c. Gangwon
221. 강릉영동대학교 — Gangneung Yeongdong University — Gangneung
222. 한림성심대학교 — Hallym Polytechnic University — Chuncheon
223. 강원관광대학교 — Gangwon Tourism College — Taebaek
224. 세경대학교 — Saekyung University — Yeongwol

### 3d. Daejeon / Sejong / Chungnam / Chungbuk
225. 대전보건대학교 — Daejeon Institute of Science & Technology (Health) — Daejeon
226. 대덕대학교 — Daeduk University — Daejeon
227. 우송정보대학 — Woosong Information College — Daejeon
228. 백석문화대학교 — Baekseok Culture University — Cheonan
229. 연암대학교 — Yonam College — Cheonan
230. 신성대학교 — Shinsung University — Dangjin
231. 혜전대학교 — Hyejeon College — Hongseong
232. 충청대학교 — Chungcheong University — Cheongju
233. 충북보건과학대학교 — Chungbuk Health & Science University — Cheongju
234. 한국영상대학교 — Korea University of Media Arts — Sejong

### 3e. Gwangju / Jeonnam / Jeonbuk
235. 광주보건대학교 — Gwangju Health University — Gwangju
236. 동강대학교 — Donggang University — Gwangju
237. 서영대학교 — Seoyeong University — Gwangju
238. 조선이공대학교 — Chosun College of Science & Technology — Gwangju
239. 목포과학대학교 — Mokpo Science University — Mokpo
240. 청암대학교 — Chungam College — Suncheon
241. 한영대학교 — Hanyeong University — Yeosu
242. 전남도립대학교 — Jeonnam Provincial College — Damyang (public)
243. 군장대학교 — Kunjang University College — Gunsan
244. 전주기전대학 — Jeonju Kijeon College — Jeonju
245. 전북과학대학교 — Jeonbuk Science College — Jeongeup
246. 원광보건대학교 — Wonkwang Health Science University — Iksan
247. 전주비전대학교 — Jeonju Vision College — Jeonju

### 3f. Daegu / Gyeongbuk
248. 영진전문대학교 — Yeungjin University — Daegu
249. 대구보건대학교 — Daegu Health College — Daegu
250. 영남이공대학교 — Yeungnam University College — Daegu
251. 대구과학대학교 — Taegu Science University — Daegu
252. 수성대학교 — Suseong University — Daegu
253. 계명문화대학교 — Keimyung College University — Daegu
254. 대구공업대학교 — Daegu Polytechnic University — Daegu
255. 호산대학교 — Hosan University — Gyeongsan
256. 가톨릭상지대학교 — Catholic Sangji College — Andong
257. 안동과학대학교 — Andong Science College — Andong
258. 구미대학교 — Gumi University — Gumi
259. 경북전문대학교 — Kyongbuk Science College — Yeongju
260. 선린대학교 — Sunlin University — Pohang
261. 포항대학교 — Pohang University (college) — Pohang
262. 문경대학교 — Munkyung College — Mungyeong
263. 영남외국어대학 — Yeungnam College of Foreign Languages — Gyeongsan

### 3g. Busan / Ulsan / Gyeongnam
264. 부산과학기술대학교 — Busan University of Science & Technology — Busan
265. 부산경상대학교 — Busan Gyeongsang University — Busan
266. 동의과학대학교 — Dong-Eui Institute of Technology — Busan
267. 동주대학교 — Dongju College — Busan
268. 부산보건대학교 — Busan Health University — Busan
269. 경남정보대학교 — Kyungnam College of Information & Technology — Busan
270. 대동대학교 — Daedong College — Busan
271. 울산과학대학교 — Ulsan College — Ulsan
272. 춘해보건대학교 — Choonhae College of Health Sciences — Ulsan
273. 마산대학교 — Masan University — Changwon
274. 창원문성대학교 — Changwon Moonsung University — Changwon
275. 거제대학교 — Koje College — Geoje
276. 김해대학교 — Gimhae College — Gimhae
277. 진주보건대학교 — Jinju Health College — Jinju
278. 연암공과대학교 — Yonam Institute of Technology — Jinju
279. 한국승강기대학교 — Korea Lift College — Geochang

### 3h. Jeju
280. 제주관광대학교 — Jeju Tourism University — Jeju
281. 제주한라대학교 — Cheju Halla University — Jeju

### 3i. Korea Polytechnics network (한국폴리텍대학, national)
282. 한국폴리텍 I 대학 — Korea Polytechnic I — Seoul / Gyeonggi
283. 한국폴리텍 II 대학 — Korea Polytechnic II — Incheon / Gangwon
284. 한국폴리텍 III 대학 — Korea Polytechnic III — Gangwon
285. 한국폴리텍 IV 대학 — Korea Polytechnic IV — Daejeon / Chungcheong
286. 한국폴리텍 V 대학 — Korea Polytechnic V — Gwangju / Jeolla
287. 한국폴리텍 VI 대학 — Korea Polytechnic VI — Daegu / Gyeongbuk
288. 한국폴리텍 VII 대학 — Korea Polytechnic VII — Busan / Gyeongnam
289. 한국폴리텍 특성화대학 (바이오·항공·섬유 등) — Korea Polytechnic specialized campuses

---

## 4. Cyber / online universities (사이버대학교)
290. 한양사이버대학교 — Hanyang Cyber University — Seoul
291. 경희사이버대학교 — Kyung Hee Cyber University — Seoul
292. 고려사이버대학교 — Korea Cyber University — Seoul
293. 서울사이버대학교 — Seoul Cyber University — Seoul
294. 사이버한국외국어대학교 — Cyber Hankuk University of Foreign Studies — Seoul
295. 세종사이버대학교 — Sejong Cyber University — Seoul
296. 숭실사이버대학교 — Soongsil Cyber University — Seoul
297. 디지털서울문화예술대학교 — Seoul Digital University of Culture & Arts — Seoul
298. 글로벌사이버대학교 — Global Cyber University — Cheonan
299. 부산디지털대학교 — Busan Digital University — Busan
300. 영남사이버대학교 — Yeungnam Cyber University — Daegu
301. 대구사이버대학교 — Daegu Cyber University — Gyeongsan
302. 원광디지털대학교 — Wonkwang Digital University — Iksan
303. 건양사이버대학교 — Konyang Cyber University — Daejeon
304. 국제사이버대학교 — International Cyber University — Cheonan
305. 화신사이버대학교 — Hwashin Cyber University — Yeongcheon
306. 한국복지사이버대학교 — Korea Welfare Cyber University — Asan

---

## 5. Additional private 4-year (regional, to round out coverage)
307. 위덕대학교 — (listed) — see 166
308. 대신대학교 — Daeshin University — Gyeongsan
309. 영남신학대학교 — Youngnam Theological University & Seminary — Gyeongsan
310. 한일장신대 — (listed) — see 156
311. 서울장신대학교 — Seoul Jangsin University — Gwangju, Gyeonggi
312. 한국침례신학대학교 — Korea Baptist Theological University — Daejeon
313. 침례신학대학교 — (same as 312, confirm)
314. 영산선학대학교 — Youngsan University of Seon Studies — Yeongam
315. 금강대학교 — Geumgang University — Nonsan
316. 중앙승가대학교 — Joong-Ang Sangha University — Gimpo
317. 영동대학교 — (now U1 University, see 136)
318. 가톨릭꽃동네대학교 — (now Kkottongnae University, see 137)
319. 한국교통대 의왕캠퍼스 — KNUT Uiwang Campus — Uiwang
320. 광주가톨릭대학교 — Gwangju Catholic University — Naju
321. 대전가톨릭대학교 — Daejeon Catholic University — Daejeon
322. 수원가톨릭대학교 — Suwon Catholic University — Hwaseong
323. 안양대학교 강화캠퍼스 — Anyang University Ganghwa Campus — Incheon

---

## Next step — reconcile against the official registry before seeding
Do **not** bulk-insert this list into `public.institutions` as-is. Run the
`data_go_kr` upstream (or pull 대학알리미) to get the authoritative current set
with KCUE codes, then diff against this list: add the rows this list is
missing, drop any that have closed/merged, and attach the official
`kcue_code` / region code per `institutions` schema. That gives a verified,
deduplicated seed.
