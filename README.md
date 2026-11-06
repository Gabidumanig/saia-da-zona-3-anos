# Saia da Zona · 3 Anos

Plataforma do evento de aniversário com times, quiz e placar ao vivo.

## Times

- Bonete
- Marins
- Itatiaia
- Lopo

## Como ver localmente

Abre o `index.html` no browser, ou sobe um servidor simples:

```bash
npx --yes serve .
```

## Placar ao vivo (Supabase)

Já configurado no projeto `saia-da-zona-3-anos` (região São Paulo).

- URL e chave anon estão em `js/config.js`
- Schema (times, participantes, respostas, RPC e realtime) em `supabase/schema.sql`
- Dashboard: https://supabase.com/dashboard/project/xpultzlrrmqjlmiumwnf

Para resetar o placar no dia do evento, corre no SQL Editor:

```sql
update public.teams set score = 0;
delete from public.answers;
delete from public.participants;
```

## Perguntas do Quiz

Edita `js/questions.js`. Exemplo:

```js
{
  id: "q5",
  text: "A tua pergunta?",
  options: ["A", "B", "C", "D"],
  correctIndex: 1 // resposta B
}
```

## Logo

Logo oficial em `assets/logo.png`.

## Link público do evento

**https://gabidumanig.github.io/saia-da-zona-3-anos/**

Repo: https://github.com/Gabidumanig/saia-da-zona-3-anos  
GitHub Pages a servir a branch `main` (pasta root).

## Fluxo no evento

1. Participante abre o link
2. Escolhe o time (Bonete / Marins / Itatiaia / Lopo)
3. Entra no Quiz
4. Cada acerto soma pontos ao time
5. O placar atualiza para toda a gente em tempo real
