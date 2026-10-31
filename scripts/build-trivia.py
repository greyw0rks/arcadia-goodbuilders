"""Build frozen, answer-checked trivia banks. No network access at runtime."""
from pathlib import Path
from collections import Counter, defaultdict
from fractions import Fraction
import hashlib
import json
import math
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/trivia"
TIERS = ("easy", "medium", "hard", "extreme")


def rank(value):
    return hashlib.sha256(str(value).encode()).hexdigest()


def rows(name):
    return json.loads((DATA / "sources" / f"{name}.json").read_text())["results"]["bindings"]


def label(row, field):
    return row[field]["value"].strip()


def entity(row, field):
    return label(row, field).rsplit("/", 1)[-1]


def text_number(value):
    if isinstance(value, Fraction):
        return str(value.numerator) if value.denominator == 1 else f"{value.numerator}/{value.denominator}"
    return str(value)


def make(key, game, tier, topic, prompt, answer, alternatives, explanation, source="Arcadia editorial"):
    answer = str(answer).strip()
    wrong = sorted({str(x).strip() for x in alternatives if str(x).strip().casefold() != answer.casefold()}, key=lambda x: rank(key + x))
    assert len(wrong) >= 3, (key, answer, wrong)
    return {"id": key, "revision": 1, "game": game, "difficulty": tier, "category": topic,
            "prompt": prompt, "options": [answer, *wrong[:3]], "answerIndex": 0,
            "explanation": explanation, "source": source}


def numeric(key, game, tier, topic, prompt, answer, explanation):
    if isinstance(answer, Fraction) and answer.denominator != 1:
        candidates = [Fraction(answer.numerator + n, answer.denominator + d) for n in range(-2, 3) for d in range(-2, 3) if answer.denominator + d > 0]
        if 0 < answer < 1: candidates = [x for x in candidates if x <= 1]
    else:
        candidates = [answer + x for x in (-3, -2, -1, 1, 2, 3, 5)]
    if answer >= 0:
        candidates = [x for x in candidates if x >= 0]
    return make(key, game, tier, topic, prompt, text_number(answer), [text_number(x) for x in candidates], explanation, "Arcadia calculated problem")


def maths():
    result = []
    # Ten problem families at each tier. Five have 13 versions and five have 12.
    # Every answer is calculated exactly with integer or rational arithmetic.
    for level, tier in enumerate(TIERS):
        for family in range(10):
            for i in range(13 if family < 5 else 12):
                a, b = i + 3, i % 7 + 2
                key = f"maths-{tier}-{family + 1}-{i + 1}"
                topic = "arithmetic"
                if level == 0:
                    if family == 0: prompt, answer, why = f"What is {a + 12} + {b + 7}?", a + b + 19, "Add the two whole numbers."
                    elif family == 1: prompt, answer, why = f"What is {a + 32} − {b + 5}?", a - b + 27, "Subtract the second whole number from the first."
                    elif family == 2: prompt, answer, why = f"What is {a} × {b}?", a * b, "Multiply the two whole numbers."
                    elif family == 3: prompt, answer, why = f"What is {a * b} ÷ {b}?", a, f"{b} × {a} = {a * b}."
                    elif family == 4: prompt, answer, why = f"What is 10% of {a * 30}?", a * 3, "Ten percent means dividing by ten."
                    elif family == 5: prompt, answer, why = f"What is half of {a * 14}?", a * 7, "Half means dividing by two."
                    elif family == 6: prompt, answer, why = f"What is one quarter of {a * 12}?", a * 3, "One quarter means dividing by four."
                    elif family == 7:
                        topic = "geometry"; prompt, answer, why = f"A rectangle is {a} cm long and {b} cm wide. What is its area in cm²?", a * b, "A rectangle's area is length multiplied by width."
                    elif family == 8:
                        topic = "geometry"; prompt, answer, why = f"What is the perimeter, in cm, of a square with side {a} cm?", 4 * a, "A square's perimeter is four times its side."
                    else: prompt, answer, why = f"How many seconds are in {a} minutes?", a * 60, "Each minute contains 60 seconds."
                elif level == 1:
                    if family == 0:
                        topic = "algebra"; prompt, answer, why = f"If {b}x + {a} = {b * (a + 1) + a}, what is x?", a + 1, f"Subtract {a}, then divide by {b}."
                    elif family == 1: prompt, answer, why = f"A recipe's flour-to-sugar ratio is 3:2. With {a * 3} cups of flour, how many cups of sugar are needed?", a * 2, "Use two cups of sugar for every three cups of flour."
                    elif family == 2: prompt, answer, why = f"What is {a * 20} increased by 15%?", a * 23, "Multiply the original value by 1.15."
                    elif family == 3:
                        topic = "statistics"; prompt, answer, why = f"What is the arithmetic mean of {a}, {a + 2}, and {a + 4}?", a + 2, "Add the three numbers and divide by three."
                    elif family == 4:
                        topic = "probability"; prompt, answer, why = f"A bag contains {a} red and {b} blue marbles. What is the probability of drawing red on one random draw?", Fraction(a, a + b), "Favourable outcomes divided by all equally likely outcomes gives the probability."
                    elif family == 5:
                        topic = "number-theory"; prompt, answer, why = f"What is the remainder when {a * 7 + b} is divided by 7?", b % 7, "Multiples of seven leave no remainder; reduce the remaining part modulo seven."
                    elif family == 6: prompt, answer, why = f"What is {a}²?", a * a, "Squaring means multiplying a number by itself."
                    elif family == 7: prompt, answer, why = f"What is the positive square root of {(a + 10) ** 2}?", a + 10, "The positive square root is the positive number whose square is the given value."
                    elif family == 8: prompt, answer, why = f"What is 1/{b} + 1/{b + a}?", Fraction(1, b) + Fraction(1, b + a), "Use a common denominator, add the numerators, then simplify."
                    else:
                        topic = "geometry"; prompt, answer, why = f"A triangle has base {a * 2} cm and perpendicular height {b} cm. What is its area in cm²?", a * b, "A triangle's area is one half times base times perpendicular height."
                elif level == 2:
                    if family == 0:
                        topic = "algebra"; prompt, answer, why = f"What is the sum of the roots of x² − {a + b}x + {a * b} = 0?", a + b, "For x² − sx + p = 0, the sum of the roots is s."
                    elif family == 1:
                        topic = "series"; prompt, answer, why = f"An arithmetic sequence starts at {a} and increases by {b}. What is its tenth term?", a + 9 * b, "The tenth term is the first term plus nine common differences."
                    elif family == 2:
                        topic = "combinatorics"; prompt, answer, why = f"How many distinct two-person teams can be chosen from {a + 4} people?", math.comb(a + 4, 2), "Use n(n−1)/2 because the order of the two teammates does not matter."
                    elif family == 3:
                        topic = "combinatorics"; prompt, answer, why = f"From {a + 4} people, how many ways are there to choose a president and a different secretary?", (a + 4) * (a + 3), "There are n choices for president and n−1 for secretary; the roles are distinct."
                    elif family == 4:
                        topic = "linear-algebra"; prompt, answer, why = f"What is the determinant of the 2×2 matrix with rows ({a}, 2) and (3, {b + 3})?", a * (b + 3) - 6, "For rows (a,b) and (c,d), the determinant is ad−bc."
                    elif family == 5:
                        topic = "number-theory"; prompt, answer, why = f"What is the greatest common divisor of {a * 6} and {a * 9}?", a * 3, "The greatest common divisor of 6 and 9 is 3; both numbers share the extra factor."
                    elif family == 6:
                        topic = "number-theory"; prompt, answer, why = f"What is the least common multiple of {a * 4} and {a * 6}?", a * 12, "The least common multiple of 4 and 6 is 12; multiply by their shared extra factor."
                    elif family == 7:
                        topic = "algebra"; prompt, answer, why = f"If f(x) = {b}x² − {a} and x = 3, what is f(3)?", b * 9 - a, "Substitute 3 for x and evaluate the square before multiplying."
                    elif family == 8:
                        topic = "statistics"; prompt, answer, why = f"A dataset has {a} entries with mean 8. One entry of value 8 is added. What is the new total of all entries?", 8 * (a + 1), "The original total is count times mean; add the new value."
                    else:
                        topic = "series"; prompt, answer, why = f"What is the sum of all integers from 1 through {a + 10}?", (a + 10) * (a + 11) // 2, "The sum from 1 through n is n(n+1)/2."
                else:
                    if family == 0:
                        topic = "calculus"; prompt, answer, why = f"For f(x) = {a}x^{b} ln(x), what is f″(1)?", a * (2 * b - 1), "Apply the product rule twice. At x=1, ln(1)=0 and the remaining factor is coefficient×(2×exponent−1)."
                    elif family == 1:
                        topic = "calculus"; prompt, answer, why = f"What is the definite integral of x^{a}(1−x) from x=0 to x=1?", Fraction(1, (a + 1) * (a + 2)), "Integrate the two powers separately: 1/(n+1)−1/(n+2)=1/((n+1)(n+2))."
                    elif family == 2:
                        topic = "number-theory"; prompt, answer, why = f"What is Euler's totient φ(2^{a} × 3²)?", 6 * 2 ** (a - 1), "Totients multiply for coprime factors: φ(2^a)=2^(a−1) and φ(9)=6."
                    elif family == 3:
                        topic = "number-theory"; prompt, answer, why = f"What is the multiplicative inverse of {a} modulo 17, expressed between 0 and 16?", pow(a, -1, 17), "The inverse is the unique residue whose product with the number is congruent to 1 modulo 17."
                    elif family == 4:
                        topic = "combinatorics"; prompt, answer, why = f"What is the coefficient of x³ in (1+x)^{a + 3}?", math.comb(a + 3, 3), "The binomial theorem gives the coefficient as n choose 3."
                    elif family == 5:
                        topic = "number-theory"; prompt, answer, why = f"How many positive perfect-square divisors does 2^{a} × 3^{b} have?", (a // 2 + 1) * (b // 2 + 1), "A square divisor has even prime exponents. Count the allowed even exponents for each prime, including zero, and multiply."
                    elif family == 6:
                        topic = "linear-algebra"; prompt, answer, why = f"An invertible 2×2 matrix A has trace {a + 5} and determinant {b}. What is trace(A⁻¹)?", Fraction(a + 5, b), "For a 2×2 matrix, the inverse has trace equal to the original trace divided by the determinant."
                    elif family == 7:
                        topic = "series"; prompt, answer, why = f"What is the infinite sum of {a}n/2ⁿ for integers n from 1 to infinity?", a * 2, "The identity Σ(nr^n)=r/(1−r)² gives 2 when r=1/2. Multiply by the coefficient."
                    elif family == 8:
                        topic = "complex-numbers"; prompt, answer, why = f"What is the squared modulus of ({a}+{b}i)/(1+i)?", Fraction(a * a + b * b, 2), "Squared moduli divide: the numerator contributes a²+b² and |1+i|²=2."
                    else:
                        topic = "combinatorics"; prompt, answer, why = f"How many surjective functions map a set of {a + 3} elements onto a set of two elements?", 2 ** (a + 3) - 2, "There are 2^n total functions. Only the two constant functions fail to hit both target elements."
                result.append(numeric(key, "maths", tier, topic, prompt, answer, f"{why} The result is {text_number(answer)}."))
    return result


def movies():
    raw = rows("film-facts")
    dates = {entity(r, "film"): label(r, "firstDate")[:4] for r in rows("film-dates")}
    review = json.loads((DATA / "film-review.json").read_text())
    dates.update(review["years"])
    grouped = defaultdict(dict)
    exclusions = defaultdict(set)
    titles = {}
    for row in raw:
        film, prop, value = entity(row, "film"), entity(row, "property"), label(row, "valueLabel")
        if film in review["excludeFilms"] or prop in review["excludeProperties"].get(film, []): continue
        title = label(row, "filmLabel")
        if re.fullmatch(r"Q\d+", value) or re.fullmatch(r"Q\d+", title) or len(value) > 90: continue
        if prop == "P364":
            value = {"American English": "English", "British English": "English", "Standard Chinese": "Mandarin Chinese", "Standard Mandarin": "Mandarin Chinese"}.get(value, value)
        grouped[film].setdefault(prop, set()).add(value)
        titles[film] = title
    for film, properties in review["credits"].items():
        for prop, values in properties.items():
            exclusions[(film, prop)].update(grouped[film].get(prop, set()))
            grouped[film][prop] = set(values)
    pools = {prop: set().union(*(values.get(prop, set()) for values in grouped.values())) for prop in ("P57", "P86", "P344", "P1040", "P58", "P162", "P364", "P144")}
    for film, year in dates.items():
        if film in grouped and year.isdigit() and 1900 <= int(year) <= 2026:
            grouped[film]["year"] = {year}
    pools["year"] = {str(year) for year in range(1900, 2027)}
    forms = {
        "P57": ("film-directors", "Which filmmaker is credited as a director of {film}?", "{answer} is credited as a director of {film}."),
        "P86": ("film-music", "Who is credited as a composer for {film}?", "{answer} is credited among the composers for {film}."),
        "P344": ("film-camera", "Who is credited for the cinematography of {film}?", "{answer} is credited as a cinematographer on {film}."),
        "P1040": ("film-editing", "Who is credited as an editor of {film}?", "{answer} is credited as an editor of {film}."),
        "P58": ("film-writing", "Who is credited as a screenwriter of {film}?", "{answer} is credited among the screenwriters of {film}."),
        "P162": ("film-production", "Who is credited as a producer of {film}?", "{answer} is credited among the producers of {film}."),
        "P364": ("film-origins", "Which of these is an original language of {film}?", "{answer} is listed among the original languages of {film}."),
        "year": ("film-history", "In which year was {film} first released?", "{film} was first released in {answer}."),
        "P144": ("film-adaptations", "Which work is listed as source material for {film}?", "{film} is based on or adapted from {answer}."),
    }
    # Language labels overlap (for example Italian and Sicilian), so do not
    # use them as mutually exclusive choices. Release years avoid that issue.
    preferences = [("P57", "year"), ("P86", "P58", "P144"), ("P344", "P58", "P86"), ("P1040", "P162", "P344")]
    selected = []; used = set(); film_count = Counter()
    popularity = {entity(r, "film"): int(label(r, "links")) for r in rows("film-list")}
    for tier, props in zip(TIERS, preferences):
        candidates = []
        for film, values in grouped.items():
            if film not in dates or not dates[film].isdigit(): continue
            display = f"{titles[film]} ({dates[film]})"
            for prop in props:
                if prop not in values or (film, prop) in used: continue
                if prop == "year" and ("P57" not in values or sum(t == titles[film] for t in titles.values()) > 1 or dates[film] in titles[film]): continue
                answers = values[prop]
                answer = sorted(answers, key=lambda x: rank(film + prop + x))[0]
                # Exclude every credited person/work, not just the chosen answer.
                wrong = pools[prop] - answers - exclusions[(film, prop)]
                if prop == "year": wrong = {str(int(answer) + delta) for delta in (-5, -3, -2, -1, 1, 2, 3, 5)}
                if len(wrong) < 3: continue
                topic, prompt, why = forms[prop]
                question_display = f"{titles[film]}, directed by {sorted(values['P57'])[0]}," if prop == "year" else display
                candidates.append((film, prop, make(f"movies-{film.lower()}-{prop.lower()}", "movies", tier, topic, prompt.format(film=question_display), answer, wrong, why.format(film=question_display, answer=answer), f"https://www.wikidata.org/wiki/{film}")))
        counts = Counter()
        for _ in range(125):
            available = [x for x in candidates if (x[0], x[1]) not in used]
            choice = min(available, key=lambda x: (counts[x[1]], film_count[x[0]], -popularity.get(x[0], 0) if tier == "easy" else 0, rank(x[2]["id"])))
            film, prop, question = choice
            selected.append(question); used.add((film, prop)); counts[prop] += 1; film_count[film] += 1
    return selected


def general():
    candidates = []
    capitals = defaultdict(set); countries = {}; links = {}
    for row in rows("country-capitals"):
        country, capital = entity(row, "country"), label(row, "capitalLabel")
        if re.fullmatch(r"Q\d+", capital): continue
        capitals[country].add(capital); countries[country] = label(row, "countryLabel"); links[country] = int(label(row, "links"))
    pool = set().union(*capitals.values())
    ordered = sorted(capitals, key=lambda c: (-links[c], c))
    for i, country in enumerate(ordered):
        tier = TIERS[min(3, i * 4 // len(ordered))]
        answer = sorted(capitals[country])[0]
        candidates.append(make(f"general-capital-{country.lower()}", "general", tier, "geography", f"Which city is a capital of {countries[country]}?", answer, pool - capitals[country], f"{answer} is a capital of {countries[country]}.", f"https://www.wikidata.org/wiki/{country}"))
    elements = [r for r in rows("elements") if label(r, "number").isdigit() and 1 <= int(label(r, "number")) <= 118 and re.fullmatch(r"[A-Z][a-z]?", label(r, "symbol"))]
    names = [label(r, "elementLabel").capitalize() for r in elements]
    symbols = [label(r, "symbol") for r in elements]
    for row in elements:
        number, name, symbol, qid = int(label(row, "number")), label(row, "elementLabel").capitalize(), label(row, "symbol"), entity(row, "element")
        for kind in ("symbol", "number"):
            tier = TIERS[min(3, (number - 1) // 30 + (1 if kind == "number" else 0))]
            if kind == "symbol": prompt, answer, wrong = f"Which chemical symbol represents {name.lower()}?", symbol, symbols
            else: prompt, answer, wrong = f"Which element has atomic number {number}?", name, names
            candidates.append(make(f"general-element-{kind}-{number}", "general", tier, "science", prompt, answer, wrong, f"{name} has symbol {symbol} and atomic number {number}.", f"https://www.wikidata.org/wiki/{qid}"))
    books = [line.split("|") for line in (DATA / "books.txt").read_text().splitlines() if line.strip()]
    authors = {author for _, author in books}
    for i, (book, author) in enumerate(books):
        tier = TIERS[min(3, i * 4 // len(books))]
        if i >= 108: tier = "medium"  # Widely read children's classics are not expert-only facts.
        candidates.append(make(f"general-book-{i + 1}", "general", tier, "history-culture", f"Who wrote {book}?", author, authors, f"{book} was written by {author}.", "Arcadia curated bibliography"))
    # Reuse the reviewed mixed-bank general knowledge as additional breadth.
    legacy = json.loads((DATA / "sources/legacy-questions.json").read_text())
    for question in legacy:
        if question["category"] in ("celo-gooddollar", "wallet-safety"): continue
        candidates.append({**question, "id": "general-reviewed-" + question["id"], "game": "general", "source": "Arcadia previously reviewed question bank"})
    # Additional authored facts keep easy/medium pools broad enough to support
    # equal tier sizes without relabeling obscure science as beginner content.
    for line in (DATA / "general-facts.txt").read_text().splitlines():
        if not line.strip(): continue
        tier, topic, prompt, answer, a, b, c, why = line.split("|")
        candidates.append(make("general-fact-" + rank(prompt)[:14], "general", tier, topic, prompt, answer, [a, b, c], why))
    deduplicated = {q["prompt"].casefold(): q for q in candidates}
    candidates = list(deduplicated.values())
    selected = []
    for tier in TIERS:
        available = [q for q in candidates if q["difficulty"] == tier]
        assert len(available) >= 125, ("general tier short", tier, len(available))
        counts = Counter()
        while len([q for q in selected if q["difficulty"] == tier]) < 125:
            choice = min(available, key=lambda q: (counts[q["category"]], rank(q["id"])))
            selected.append(choice); available.remove(choice); counts[choice["category"]] += 1
    return selected


def crypto():
    result = []
    concepts = [line.split("|") for line in (DATA / "crypto-concepts.txt").read_text().splitlines() if line.strip()]
    terms = [row[2] for row in concepts]
    for index, (tier, topic, term, description) in enumerate(concepts):
        same_topic = [row[2] for row in concepts if row[1] == topic and row[2] != term]
        wrong = same_topic if len(set(same_topic)) >= 3 else terms
        result.append(make(f"crypto-concept-{index + 1}", "crypto", tier, topic, f"Which term best matches this description: {description[0].lower() + description[1:]}?", term, wrong, f"{term}: {description}.", "Arcadia protocol glossary; Ethereum, Bitcoin and Celo documentation"))
    for index, line in enumerate((DATA / "crypto-scenarios.txt").read_text().splitlines()):
        if not line.strip(): continue
        tier, topic, prompt, answer, a, b, c, why = line.split("|")
        result.append(make(f"crypto-scenario-{index + 1}", "crypto", tier, topic, prompt, answer, [a, b, c], why, "Arcadia wallet-safety and Celo/GoodDollar editorial reference"))
    eips = json.loads((DATA / "sources/eips.json").read_text())
    eips = list({row["title"].casefold(): row for row in eips}.values())
    priority = [1559, 155, 191, 712, 721, 20, 1155, 1271, 2612, 2981, 4626, 4337, 165, 1014, 1967, 1822, 2535, 4844, 7702, 1153, 6780, 3541, 3855, 3860, 2930, 2929]
    eips.sort(key=lambda row: (priority.index(int(row["eip"])) if int(row["eip"]) in priority else len(priority), rank(row["title"])))
    assert len(eips) >= 100
    selected_eips = eips[:100]
    numbers = [f"EIP-{row['eip']}" for row in eips]
    for index, row in enumerate(selected_eips):
        result.append(make("crypto-standard-" + rank(row["title"])[:14], "crypto", "hard" if index < 25 else "extreme", "standards", f"Which Ethereum proposal is titled “{row['title']}”?", f"EIP-{row['eip']}", numbers, f"EIP-{row['eip']} is titled “{row['title']}” and is marked Final in the frozen reference.", row["source"]))
    opcodes = [line.split("|") for line in (DATA / "bitcoin-opcodes.txt").read_text().splitlines() if line.strip()]
    for index, (opcode, meaning) in enumerate(opcodes):
        result.append(make(f"crypto-script-{index + 1}", "crypto", "extreme", "bitcoin", f"In Bitcoin Script, which opcode {meaning}?", opcode, [x[0] for x in opcodes], f"{opcode} {meaning}.", "https://en.bitcoin.it/wiki/Script"))
    for tier, families in (("easy", 1), ("medium", 2), ("hard", 2), ("extreme", 1)):
        for family in range(families):
            for i in range(1, 26):
                key = f"crypto-calculation-{tier}-{family + 1}-{i}"
                topic = "token-math"
                if tier == "easy":
                    prompt, answer, why = f"A token has 18 decimals. How many tokens are {i * 10 ** 18:,} base units?", i, "Divide the base-unit count by 10¹⁸."
                elif tier == "medium" and family == 0:
                    topic = "evm"; prompt, answer, why = f"A transaction uses 21,000 gas at an effective price of {i + 2} gwei per gas. What is its fee in gwei?", 21000 * (i + 2), "Multiply gas used by the effective price per unit of gas."
                elif tier == "medium":
                    prompt, answer, why = f"A token allocation contains 10,000 tokens. If {i + 5}% becomes vested, how many tokens have vested?", (i + 5) * 100, "Multiply 10,000 by the vested percentage divided by 100."
                elif tier == "hard" and family == 0:
                    topic = "defi"; x, y = 100 * i, 300 * i
                    prompt, answer, why = f"A constant-product pool holds {x} A and {y} B. Ignoring fees, how much B comes out when {x // 2} A is added?", 100 * i, "Keep x×y constant. Increasing the A reserve by half reduces the B reserve to two thirds, so one third comes out."
                elif tier == "hard":
                    topic = "consensus"; n = 3 * i + 4
                    prompt, answer, why = f"With {n} equally weighted validators, what is the smallest vote count strictly greater than two thirds of all validators?", 2 * n // 3 + 1, "Take the floor of two thirds of the validator count, then add one."
                else:
                    topic = "evm"; words = i + 15
                    prompt, answer, why = f"Ignoring opcode charges, how much EVM gas expands memory from 0 to {words} 32-byte words?", 3 * words + words * words // 512, "The EVM memory cost for w words is 3w + floor(w²/512); expansion charges the increase in this cost."
                result.append(numeric(key, "crypto", tier, topic, prompt, answer, f"{why} The answer is {answer}."))
    return result


def main():
    banks = {"general": general(), "maths": maths(), "crypto": crypto(), "movies": movies()}
    all_questions = []
    for game, questions in banks.items():
        assert len(questions) == 500, (game, len(questions))
        assert Counter(q["difficulty"] for q in questions) == {tier: 125 for tier in TIERS}
        assert len({q["prompt"].casefold() for q in questions}) == 500, (game, "duplicate prompt")
        for i, q in enumerate(questions):
            correct = q["options"][q["answerIndex"]]
            wrong = [x for x in q["options"] if x != correct]
            at = i % 4; q["options"] = wrong[:at] + [correct] + wrong[at:]; q["answerIndex"] = at
            assert len({x.casefold() for x in q["options"]}) == 4, q["id"]
            assert 10 < len(q["prompt"]) <= 240, (q["id"], q["prompt"])
            assert len(q["explanation"]) > 10
        all_questions.extend(questions)
    assert len({q["id"] for q in all_questions}) == 2000
    (ROOT / "lib/trivia-bank.json").write_text(json.dumps(all_questions, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({game: dict(Counter(q["difficulty"] for q in qs)) for game, qs in banks.items()}, indent=2))


if __name__ == "__main__": main()
