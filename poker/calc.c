#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

/* karta 0..51 : rank = c>>2 (0='2' .. 12='A'), suit = c&3 */

static int SH[8192];               /* maska 13 hodnot -> nejvyssi rank postupky, -1 = zadna */

static void init_sh(void){
    for (int m = 0; m < 8192; m++) {
        int best = -1;
        for (int hi = 12; hi >= 4; hi--) {
            int need = (1<<hi)|(1<<(hi-1))|(1<<(hi-2))|(1<<(hi-3))|(1<<(hi-4));
            if ((m & need) == need) { best = hi; break; }
        }
        if (best < 0) {
            int wheel = (1<<12)|1|(1<<1)|(1<<2)|(1<<3);   /* A-2-3-4-5 */
            if ((m & wheel) == wheel) best = 3;           /* "kolo", petka high */
        }
        SH[m] = best;
    }
}

typedef struct { int rc[13], sc[4], sm[4], mask; } St;

static inline void st_clear(St *S){ memset(S, 0, sizeof(*S)); }
static inline void st_add(St *S, int c){
    int r = c>>2, s = c&3;
    S->rc[r]++; S->sc[s]++; S->sm[s] |= 1<<r; S->mask |= 1<<r;
}
static inline void st_rem(St *S, int c){
    int r = c>>2, s = c&3;
    S->rc[r]--; S->sc[s]--; S->sm[s] &= ~(1<<r);
    if (S->rc[r] == 0) S->mask &= ~(1<<r);
}

/* kategorie: 0 high card, 1 par, 2 dva pary, 3 trojice, 4 postupka,
   5 barva, 6 full house, 7 ctverice, 8 straight flush, 9 royal flush */
static int eval_st(const St *S, int *catOut){
    int cat, rk[5] = {0,0,0,0,0};
    int fs = -1;
    for (int s = 0; s < 4; s++) if (S->sc[s] >= 5) fs = s;

    if (fs >= 0) {
        int sfh = SH[S->sm[fs]];
        if (sfh >= 0) { cat = (sfh == 12) ? 9 : 8; rk[0] = sfh; goto done; }
    }
    {
        int quad = -1, trips[3], nt = 0, pairs[3], np = 0;
        for (int r = 12; r >= 0; r--) {
            if      (S->rc[r] == 4) quad = r;
            else if (S->rc[r] == 3) { if (nt < 3) trips[nt++] = r; }
            else if (S->rc[r] == 2) { if (np < 3) pairs[np++] = r; }
        }
        if (quad >= 0) {
            cat = 7; rk[0] = quad;
            for (int r = 12; r >= 0; r--) if (r != quad && S->rc[r] > 0) { rk[1] = r; break; }
            goto done;
        }
        if (nt >= 2)            { cat = 6; rk[0] = trips[0]; rk[1] = trips[1]; goto done; }
        if (nt == 1 && np >= 1) { cat = 6; rk[0] = trips[0]; rk[1] = pairs[0]; goto done; }
        if (fs >= 0) {
            cat = 5; int k = 0;
            for (int r = 12; r >= 0 && k < 5; r--) if (S->sm[fs] & (1<<r)) rk[k++] = r;
            goto done;
        }
        int sh = SH[S->mask];
        if (sh >= 0) { cat = 4; rk[0] = sh; goto done; }
        if (nt == 1) {
            cat = 3; rk[0] = trips[0]; int k = 1;
            for (int r = 12; r >= 0 && k < 3; r--) if (r != trips[0] && S->rc[r] > 0) rk[k++] = r;
            goto done;
        }
        if (np >= 2) {
            cat = 2; rk[0] = pairs[0]; rk[1] = pairs[1];
            for (int r = 12; r >= 0; r--)
                if (r != pairs[0] && r != pairs[1] && S->rc[r] > 0) { rk[2] = r; break; }
            goto done;
        }
        if (np == 1) {
            cat = 1; rk[0] = pairs[0]; int k = 1;
            for (int r = 12; r >= 0 && k < 4; r--) if (r != pairs[0] && S->rc[r] > 0) rk[k++] = r;
            goto done;
        }
        cat = 0; { int k = 0; for (int r = 12; r >= 0 && k < 5; r--) if (S->rc[r] > 0) rk[k++] = r; }
    }
done:
    if (catOut) *catOut = cat;
    int sco = cat;
    for (int i = 0; i < 5; i++) sco = sco * 13 + rk[i];
    return sco;
}

static int eval_cards(const int *cards, int n, int *catOut){
    St S; st_clear(&S);
    for (int i = 0; i < n; i++) st_add(&S, cards[i]);
    return eval_st(&S, catOut);
}

static uint64_t rng_s = 0x9E3779B97F4A7C15ULL;
static inline uint64_t rnd64(void){
    rng_s ^= rng_s << 13; rng_s ^= rng_s >> 7; rng_s ^= rng_s << 17; return rng_s;
}
static inline int rnd_below(int n){ return (int)(rnd64() % (uint64_t)n); }

static const char *RANKCH = "23456789TJQKA";

int main(void){
    init_sh();

    long long totalRiver[10] = {0};          /* kontrolni soucet pres vsech 169 */
    long long totalCombos = 0;

    printf("{\n");
    int first = 1;

    for (int hi = 12; hi >= 0; hi--) {
        for (int lo = 12; lo >= 0; lo--) {
            /* hi >= lo; suited jen kdyz hi != lo */
            for (int suited = 1; suited >= 0; suited--) {
                if (hi < lo) continue;
                if (hi == lo && suited == 0) continue;      /* par resime jen jednou */
                if (hi == lo && suited == 1) { /* par */ }
                else if (hi == lo) continue;

                int hole[2];
                char code[8];
                int combos;
                if (hi == lo) {
                    hole[0] = hi*4 + 0; hole[1] = hi*4 + 1;
                    snprintf(code, sizeof(code), "%c%c", RANKCH[hi], RANKCH[lo]);
                    combos = 6;
                } else if (suited) {
                    hole[0] = hi*4 + 0; hole[1] = lo*4 + 0;
                    snprintf(code, sizeof(code), "%c%cs", RANKCH[hi], RANKCH[lo]);
                    combos = 4;
                } else {
                    hole[0] = hi*4 + 0; hole[1] = lo*4 + 1;
                    snprintf(code, sizeof(code), "%c%co", RANKCH[hi], RANKCH[lo]);
                    combos = 12;
                }

                int deck[50], nd = 0;
                for (int c = 0; c < 52; c++)
                    if (c != hole[0] && c != hole[1]) deck[nd++] = c;

                /* ---- presna enumerace riveru: vsech C(50,5) = 2 118 760 boardu ---- */
                long long riv[10] = {0};
                St S; st_clear(&S); st_add(&S, hole[0]); st_add(&S, hole[1]);
                for (int a = 0; a < nd-4; a++) { st_add(&S, deck[a]);
                for (int b = a+1; b < nd-3; b++) { st_add(&S, deck[b]);
                for (int c = b+1; c < nd-2; c++) { st_add(&S, deck[c]);
                for (int d = c+1; d < nd-1; d++) { st_add(&S, deck[d]);
                for (int e = d+1; e < nd;   e++) { st_add(&S, deck[e]);
                    int cat; eval_st(&S, &cat); riv[cat]++;
                    st_rem(&S, deck[e]); }
                    st_rem(&S, deck[d]); }
                    st_rem(&S, deck[c]); }
                    st_rem(&S, deck[b]); }
                    st_rem(&S, deck[a]); }

                long long rivTot = 2118760LL;
                for (int i = 0; i < 10; i++) totalRiver[i] += riv[i] * combos;
                totalCombos += rivTot * combos;

                /* ---- presna enumerace flopu: vsech C(50,3) = 19 600 ---- */
                long long flop[10] = {0};
                long long fd = 0, oesd = 0, gut = 0;
                st_clear(&S); st_add(&S, hole[0]); st_add(&S, hole[1]);
                for (int a = 0; a < nd-2; a++) { st_add(&S, deck[a]);
                for (int b = a+1; b < nd-1; b++) { st_add(&S, deck[b]);
                for (int c = b+1; c < nd;   c++) { st_add(&S, deck[c]);
                    int cat; eval_st(&S, &cat); flop[cat]++;
                    /* flush draw = presne 4 karty jedne barvy z 5 */
                    if (cat < 5) {
                        for (int s = 0; s < 4; s++) if (S.sc[s] == 4) { fd++; break; }
                    }
                    /* postupkove draws */
                    if (SH[S.mask] < 0) {
                        int outs = 0;
                        for (int r = 0; r < 13; r++)
                            if (!(S.mask & (1<<r)) && SH[S.mask | (1<<r)] >= 0) outs++;
                        if (outs >= 2) oesd++; else if (outs == 1) gut++;
                    }
                    st_rem(&S, deck[c]); }
                    st_rem(&S, deck[b]); }
                    st_rem(&S, deck[a]); }
                long long flopTot = 19600LL;

                /* ---- equity Monte Carlo ---- */
                double eq1 = 0.0, eq6 = 0.0;
                int NS1 = 200000, NS6 = 150000;
                int tmp[50];
                for (int pass = 0; pass < 2; pass++) {
                    int nopp = (pass == 0) ? 1 : 5;
                    int trials = (pass == 0) ? NS1 : NS6;
                    int need = 5 + 2*nopp;
                    double acc = 0.0;
                    for (int t = 0; t < trials; t++) {
                        memcpy(tmp, deck, sizeof(int)*nd);
                        for (int i = 0; i < need; i++) {
                            int j = i + rnd_below(nd - i);
                            int sw = tmp[i]; tmp[i] = tmp[j]; tmp[j] = sw;
                        }
                        int mine[7];
                        mine[0] = hole[0]; mine[1] = hole[1];
                        for (int i = 0; i < 5; i++) mine[2+i] = tmp[i];
                        int mysc = eval_cards(mine, 7, NULL);
                        int ties = 1, lost = 0;
                        for (int o = 0; o < nopp; o++) {
                            int oc[7];
                            oc[0] = tmp[5 + 2*o]; oc[1] = tmp[6 + 2*o];
                            for (int i = 0; i < 5; i++) oc[2+i] = tmp[i];
                            int s = eval_cards(oc, 7, NULL);
                            if (s > mysc) { lost = 1; break; }
                            if (s == mysc) ties++;
                        }
                        if (!lost) acc += 1.0 / ties;
                    }
                    if (pass == 0) eq1 = acc / trials; else eq6 = acc / trials;
                }

                if (!first) printf(",\n");
                first = 0;
                printf("\"%s\":{\"c\":%d,\"r\":[", code, combos);
                for (int i = 0; i < 10; i++)
                    printf("%s%.4f", i ? "," : "", 100.0 * riv[i] / rivTot);
                printf("],\"f\":[");
                for (int i = 0; i < 10; i++)
                    printf("%s%.4f", i ? "," : "", 100.0 * flop[i] / flopTot);
                printf("],\"fd\":%.3f,\"os\":%.3f,\"gs\":%.3f,\"e1\":%.3f,\"e6\":%.3f}",
                       100.0*fd/flopTot, 100.0*oesd/flopTot, 100.0*gut/flopTot,
                       100.0*eq1, 100.0*eq6);
                fflush(stdout);
            }
        }
    }
    printf("\n}\n");

    /* kontrola: vazeny prumer pres vsech 169 = rozdeleni nahodnych 7 karet */
    fprintf(stderr, "\n--- kontrola: rozdeleni nahodne 7-karetni ruky ---\n");
    const char *nm[10] = {"high card","par","dva pary","trojice","postupka",
                          "barva","full house","ctverice","str. flush","royal"};
    for (int i = 0; i < 10; i++)
        fprintf(stderr, "%-12s %9.5f %%\n", nm[i], 100.0 * (double)totalRiver[i] / (double)totalCombos);
    return 0;
}
