# LLM vs Decision Model: research, integration and results

Course: AI Systems Integration & Operations (BCS S5, EPITA 2026) — Triage App, DM assignment.

## 1. Decision model research

A decision model reads a *state* (here: a ticket) and *typed questions* (choice / yes-no / score) and returns a
probability per answer, in one pass, without generating text. It is an "intelligent `switch` statement", not a
replacement for an LLM.

### Options found

| Option | Access (Oct 2026) | Free? | Endpoint | Verdict |
|---|---|---|---|---|
| **vLLM Semantic Router — Decision 3.0** (`vllm-sr/d3-turbo`, `d3-flash`, …) | Hosted API at `decision.vllm-sr.ai`, key in one click, no account | **Yes** (own rate/size limits: 64 questions, 131k chars per request) | `POST /v1/systemone` | **Selected** |
| TypeSafe AI — Jev (System One) | Early access | No / signups paused (22 Sept) | `POST /v1/systemone` | Not available to try |
| OpenAI — Decisions API (GPT-6 Luna) | Public beta since 6 Oct | No (paid API key) | `POST /v1/decisions` | Needs billing |
| OpenRouter — Jev (`typesafe/jev-1.13`) | Gateway | No (input tokens charged) | `/api/v1/systemone` | Needs credit |
| Cloudflare — Clef / Clef-flash | Open weights (Apache 2.0), Workers AI | Weights free, hosting is not | Not confirmed | Would need self-hosting (27B / 9B) |
| AWS — Strands Decider | Open source (1.9B) | Free but self-hosted | n/a | Needs my own GPU/server |
| Perplexity — pplx-decider-v1-27b | Decisions API + open weights | Not confirmed | Not confirmed | Not verified |
| Liquid AI — d1 | Hosted API only | Not confirmed | Not confirmed | Not verified |

Rows other than vLLM Semantic Router come from the course slides ("Who offers which endpoint", October 2026, "subject
to errors and changes"); I did not test them. For the selected option I checked the model card of `vllm-sr/d3-turbo`
(Hugging Face), which documents the free key, the request/response format and the limits.

### Why `vllm-sr/d3-turbo` via `decision.vllm-sr.ai`

1. **It is actually free and usable today** (one click for a key, no card, no waiting list).
2. **Same `System One` contract as Jev** (`state` + `questions` → probabilities), so the integration is not tied to one
   vendor; switching to TypeSafe or OpenRouter would mostly be a change of `DM_BASE_URL` and key.
3. **One request answers several questions**: category, priority and "needs human review" cost one call.
4. The free API accepts a second model (`vllm-sr/d3-flash`), which gives the model-switching menu a real second choice.

Known limits: the free tier has its own rate limits; the category set is small (4), which suits decision models
(accuracy drops on large label sets); confidence values must be checked, not trusted (slides: 87% confidence vs 75%
accuracy in one independent test).

## 2. Integration strategy

The user picks the strategy in the front end (menu at the top, used by *Triage* and *Smoke test*):

| Strategy | What happens | LLM calls | Why you would choose it |
|---|---|---|---|
| `llm` | The LLM returns category, priority, human-review flag and summary as JSON (validated with Zod, one retry if invalid) | 1 (2 if retry) | Best "reasoning", writes a real summary |
| `dm` | The decision model answers 3 typed questions in one request. The "summary" is just the subject line | 0 | Fastest and cheapest; no free text |
| `dm+llm` | The DM decides the labels. If its confidence on category or priority is below `DM_CONFIDENCE_THRESHOLD` (default 0.6), the **LLM takes over** (escalation). Otherwise the LLM only writes a one-sentence summary | 1 | Cheap labels + useful text; the LLM is the safety net when the DM is unsure |

Design choices:

- **Decision models choose, LLMs write.** Classification (closed set of options, high volume, we act on a probability)
  is a good fit; the summary needs writing, so it stays with the LLM.
- **Thinking models and failures.** The free LLM I used (`recursive/flint-v1.0:free`) is a reasoning model: in my first
  smoke tests it often returned an empty answer ("LLM provider returned no text") because hidden thinking used up the
  token limit. The LLM client now asks for low reasoning effort, adds token headroom and retries once. In `dm+llm`, if the
  LLM still fails, the decision model's answer is kept and the run counts it as an "LLM fallback" instead of a failed ticket.
- **Untrusted input.** The ticket text can contain prompt injection (the labelled set has tickets tagged
  `adversarial|prompt_injection`). Both prompts tell the model to ignore instructions inside the ticket, the ticket is
  delimited by `<ticket>` tags, and the output is always validated (Zod for the LLM JSON; closed option sets for the DM).
- **Typed output constrains the shape, not the judgment** — a valid answer can still be wrong, which is why the smoke
  test compares with the labels.
- **Logging.** Every smoke run (accuracy, outcome counts, latency, cost, model name) and every triage/chat call is
  written to `data/logs/*.jsonl`; `/admin` lists them and compares two runs side by side.

## 3. How I ran the experiment

I used the smoke test tab on the **labelled 100** set. For each strategy I sampled **10 tickets at random** and ran them.
The setup was the same each time: the free LLM `recursive/flint-v1.0:free` (OpenRouter), the free decision model
`vllm-sr/d3-turbo`, `SMOKE_CONCURRENCY=2`, and the escalation threshold at its default of 0.6.

**Important:** every run draws its own random tickets. The three runs did **not** see the same 10 tickets, and 10 tickets
is a very small sample (one ticket = 10 percentage points). Treat the numbers as a first look, not as proof.

## 4. Results

| Run | Model(s) | Category accuracy | Priority accuracy | Failed | Escalated to LLM | Avg latency | p95 latency | Wall time | Cost |
|---|---|---|---|---|---|---|---|---|---|
| `llm` | recursive/flint-v1.0:free | 100% (10/10) | 90% (9/10) | 0 | – | 7,373 ms | 34,865 ms | 39.5 s | $0 |
| `dm` | vllm-sr/d3-turbo | 90% (9/10) | 50% (5/10) | 0 | – | 260 ms | 394 ms | 1.4 s | $0 |
| `dm+llm` | vllm-sr/d3-turbo + recursive/flint-v1.0:free | 100% (10/10) | 60% (6/10) | 0 (0 LLM fallbacks) | 4 of 10 | 3,723 ms | 7,067 ms | 19.8 s | $0 |

Cost is $0 everywhere because both services were on their free tier, so it does not tell me anything about real prices.

What the mismatches looked like:

- **`llm`:** one error, a billing ticket marked `high` instead of `medium`.
- **`dm`:** five priority errors and one category error. All five priority errors were one level too high (three `high`
  instead of `medium`, two `medium` instead of `low`). The category error was a ticket predicted `technical_bug` that was labelled `account`.
- **`dm+llm`:** four priority errors, again all one level too high (two `high` instead of `medium`, two `medium` instead of `low`), and no category errors.

## 5. Analysis

**Accuracy.** The LLM was the most accurate on priority (90%), and category was right every time for both the LLM and
`dm+llm`. The decision model alone was good at category (90%) but weak at priority (50%). Because the sample is only 10
tickets per run, the category differences (100% vs 90%) are within the noise. The priority gap between `llm` (90%) and
`dm` (50%) is bigger, and it matches what I saw in the errors, so I trust that one more than the others.

**Speed.** This is where the decision model clearly wins. It averaged 260 ms against 7,373 ms for the LLM, which is about
28 times faster (about 17 times if I leave out the one LLM ticket that took 34.9 s). That slow ticket looks like a
free-tier hiccup, but I did not investigate it. My `dm` result (260 ms) is in the same range as the 0.2 s the course
slides give, but the slides' "100x cheaper, 200x faster" claims are vendor numbers and I could not confirm them. I could
not measure cost differences either, because everything was free.

**What `dm+llm` did.** It was about twice as fast as the LLM alone (3,723 ms vs 7,373 ms) because in 6 of 10 tickets the
LLM only wrote a short summary. In 4 of 10 tickets the decision model was unsure, so the LLM decided everything. There were
no LLM failures after I fixed the empty-answer problem. Its priority accuracy (60%) was much lower than the LLM's (90%).
With this data I cannot say how much of that comes from the six tickets where the decision model decided the priority,
because I did not log which tickets were which. That would be the first thing to check.

**Mistakes.** Every priority error in all three runs was **one level too high**, never two levels off, and never too
low. So the models seem to over-react to urgent-sounding words, and they get confused between neighbouring levels
(`low`/`medium`/`high`), which is the kind of mistake the slides warn about. I did not look at the prompt-injection
tickets on purpose, and I did not measure calibration (whether "90% sure" is right 9 times out of 10), so I cannot say
anything about either.

**Recommendation.** For category, the decision model alone looks good enough and is much faster, so I would use it for
high volumes. For priority, I would not trust it by itself yet. If I had to ship one option now, I would use `dm+llm`
but raise `DM_CONFIDENCE_THRESHOLD` and also check the priority confidence, so the LLM decides more tickets. If accuracy
matters more than speed (a low volume of tickets), the plain `llm` strategy was the most accurate here.

**What I would do next:** run all 100 labelled tickets for each strategy, so the runs use exactly the same tickets; log
which tickets were escalated; test a higher threshold such as 0.8; and measure calibration.

## 6. How this is relevant to the Support Ticket Triage App

**What a decision model can and cannot do.** It can sort a ticket into a fixed list of options and say how sure it is, in
one fast request. In my app it picks the category and the priority, and answers yes or no to "does a human need to look at
this?". It cannot write, summarise or explain, and it can only choose from the options I give it. It can also be wrong
while sounding sure.

**How it can be used.** As the first sorting step on every ticket, because the answers come from a small list I know in
advance, the volume can be high, and I can act on the confidence number (send unsure tickets to the LLM or to a person).
It could also be a cheap guard before the LLM, for example "does this ticket try to trick us?".

**LLM, DM, or DM + LLM.** The LLM is the most flexible and writes real summaries, but it is slower. The decision model is
the fastest, but it has no summary and it was weak on priority. `dm+llm` mixes both: the decision model sorts, the LLM
writes the summary or takes over when the decision model is unsure.

**What to measure.** Accuracy of category and priority against the labels, latency (average and p95), cost, failures and
LLM fallbacks, how often `dm+llm` escalates, whether the mistakes are between neighbouring options or real misses, and
calibration.

## 7. Limitations

- Only **10 tickets per run**, and a **different random sample** for each strategy, so the strategies are not directly comparable.
- One dataset, one LLM and one decision model, all on free tiers (rate limits and slow moments can distort latency).
- Cost is $0 because everything was free; I did not measure real prices.
- Vendor numbers are vendor numbers, and the category is only weeks old (Decision 1.0 was deprecated after about a week).
- My first smoke tests had many failures ("LLM provider returned no text"). The cause was the free model using its tokens for hidden thinking. After the fix (low reasoning effort, more token room, one retry) there were no failures in the three runs above.
