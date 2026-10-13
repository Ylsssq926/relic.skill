# FAQ

## 1. What exactly is relic.skill?

It is not a wishing well, nor a chatbot with a new face. More precisely, it is an open protocol that organizes memory, relationships, and persona clues into an interactive Relic: you give it chats, voice, photos, emails, and shared experiences; it gathers those fragments into an object an AI can read — and a human can audit.

## 2. How is it different from ChatGPT?

ChatGPT is a general-purpose model — it can talk about anything a little; relic.skill turns "a certain person, a certain pet, a certain relationship, a certain place, a certain moment" into a dedicated digital object. The former is a generalist; the latter is a specialized archive with evidence, boundaries, and memory structure. You can certainly run a Relic on top of ChatGPT, but the Relic itself is not ChatGPT.

## 3. So is it "reviving" people?

No — we don't put it that way. relic.skill preserves traces, organizes memory, and reconstructs interaction cues; it does not declare "someone's soul lives in this folder." Think of it as a talking memorial hall, not a technological séance.

## 4. It sounds mystical — what's the actual technical basis?

Not mystical at all; the skeleton is plain: multi-source data collection, structured cleaning, four-dimension persona extraction, memory layering, retrieval augmentation, style constraints, and ethics gates. In plain words: get the material straight first, write the person clearly second, then make the model speak as this person — instead of letting the model freestyle on the spot.

## 5. Why "everything can be a Relic"?

Because what deserves keeping isn't only people. A pet's movement habits, a team's way of talking, the atmosphere of a place, the默契 (unspoken understanding) of a relationship, the light and emotion of a moment — all of these shape our lives. Relic cares about "what left traces," not just who has an ID card.

## 6. Can I distill a living person?

Yes — but the precondition is hard: consent first, always. For living subjects, authorization is not a polite phrase; it's the master switch. Without explicit informed consent, this shouldn't proceed.

## 7. Can I distill someone who has passed away?

Yes — but it should ideally be initiated by close family, a legal custodian, or someone clearly authorized. The more complete the material, the less the Relic is reduced to a vague "ta was nice." If material is scarce, a commemorative version is possible — but honestly mark where evidence is thin.

## 8. Can I distill a pet?

Of course — and it's one of the most fascinating parts of relic.skill. Pet Relics don't try to write cats and dogs as humans giving long speeches; they preserve what's genuinely unique: the way they walk, how they act cute, territory habits, greeting rituals, the reason for midnight sprints.

## 9. Will it distill a "fake person"?

If done crudely, yes. That's why relic.skill emphasizes evidence levels, contradiction preservation, and identity labeling. A good Relic resembles someone — but doesn't pretend to be that person, and doesn't force-fill every blank.

## 10. How close to a real person can it get?

What's most similar is usually not knowledge, but rhythm: how they talk, how they pause, how they comfort, how they snark, and what suddenly makes them serious. It can be very similar — but "similar" ≠ "equal." What's worth pursuing isn't fooling anyone; it's making people who knew them recognize at a glance: yes, this is the flavor.

## 11. Will it make things up?

As long as a generative model is involved, possibly. The difference: relic.skill tries to write "which are verbatim, which are artifacts, which are only impressions" separately, reducing the model's chances of stating guesses as fact. It can't guarantee zero hallucination — but it can compress it into a more controllable range.

## 12. Is the data safe?

The design principle is local-first. A Relic is essentially a folder; it doesn't require uploading your memory to a strange platform to exist. You of course manage your own drive, backups, and access permissions — but at least data sovereignty isn't handed over from the start.

## 13. Which platforms are supported?

The docs currently cover 12 high-frequency sources: WeChat, QQ, Telegram, Discord, Slack, Feishu, DingTalk, iMessage, WhatsApp, Twitter/X, Instagram, Gmail. Beyond that, anything organizable into TXT, JSON, CSV, or Markdown can also be plugged in.

## 14. No chat logs — can I still do it?

Yes, but the style differs. Chats are best for restoring expression habits; without them, you can supplement with voice, photos, diaries, emails, shared memories, notes, and lists. Just: the less material, the more restrained the Relic should be — don't pretend to know everything.

## 15. How much material before it feels real?

No absolute threshold, but there's a rule of thumb: if you can't even gather 10 sentences ta often says, don't expect the system to suddenly understand ta. For human subjects, 200+ valid chats, several continuous voice clips, and a few key events usually give you a silhouette; for pets and places, video and daily observation often matter more than long text.

## 16. Is it free?

The repo itself is open source — the protocol, templates, and docs are free to use. What may cost money is the model, voice service, or cloud storage you connect; if you organize everything locally and control your own runtime, costs can also be kept very low.

## 17. Will I get addicted to the Relic?

Possibly — which is why the project puts ethics up front. A Relic can accompany and help organize emotion, but it shouldn't be treated as a substitute for real relationships, nor replace professional support. Its best position is a bridge, not a room that locks people in.

## 18. Is it good for "reviewing a relationship"?

Very — provided you're willing to face reality rather than write yourself a victory declaration. The most valuable part of a relationship Relic is often not the sweetness, but the recurring communication rhythms, misunderstanding patterns, ways of making up, and how you actually got to today.

## 19. How is it different from a normal photo album or memorial book?

An album keeps the moment; a Relic tries to keep "why this moment is so you." Albums excel at preserving images; Relics excel at preserving tone, habits, relational structure, and interaction patterns. The former is a still frame; the latter is a scene that can be relit.

## 20. What's the difference from immortal-skill?

Similar direction — both are open-source explorations of digital persona and memory organization. But relic.skill has wider boundaries: it explicitly covers pets, relationships, teams, places, and moments, not just "people." It also splits `soul-forge`, `soul-engine`, and `soul-shield` into three layers, writing evidence grading, contradiction preservation, the consent protocol, and the soul fingerprint into independent rules — so it's more like an auditable Relic protocol than just a persona-distillation pipeline.

## 21. What can I contribute?

Plenty: platform export guides, new templates, better parsing scripts, more demo Relics, improved ethics docs, language fixes, translations. The plainest contribution is actually two things: ask a clearly-stated question, or add a genuinely useful piece of content.

## 22. If I just want to try it, what's the minimal path?

Pick a subject, gather a small clean set of material: a few chats, a few voice clips, a few photos, a few key memory points. Make a very small Relic first, confirm what you actually want to keep, then decide whether to expand. Don't try to package an entire life on day one — that usually just burns you out.

## 23. Why does the project keep emphasizing "this is not a real person"?

Because that sentence isn't a buzzkill — it's respect. Only by admitting a Relic is not the person can we avoid mistaking longing for possession, companionship for replacement, and technology for miracle. With the boundary clear, the gentleness doesn't spoil.

## 24. I don't know how to use a terminal. Can I still use this?

Yes — and you never have to touch a command line.

The skill has two layers, and only the first one is required:

1. **The skill itself (no terminal).** Put the `relic` folder where your AI assistant can read it, then simply talk: *"help me awaken a Relic for my grandmother"*. The assistant reads `SKILL.md`, walks you through the consent questions, distills the profile with you, and writes every file. This is the normal path and it is entirely conversational.
2. **The CLI scripts (optional, for bulk data).** `scripts/*_parser.py` and `scripts/relic_writer.py` exist so that large archives — a 200k-message Discord export, a Gmail mbox — don't have to be pasted into the chat by hand. If you'd rather not run them, hand the assistant your exported files and it can call them for you, or work from a small curated sample you type in directly.

Rule of thumb: **the terminal is an accelerator, not a requirement.** If a step only works through the CLI, that's a gap we want to hear about.

## 25. How do I delete a Relic, or take back consent?

A Relic is a folder on your own disk — deleting it is deleting the folder. Nothing is mirrored to a server by the skill itself.

For a partial withdrawal, use the protection layer rather than deleting everything:

- **Pause**: stop loading the Relic (just don't point the assistant at it).
- **Narrow**: open `manifest.json` and tighten `conversation.disclosure_policy`, or set `consent.use_scope` to a smaller scope.
- **Revoke**: run the consent protocol in `soul-shield/consent-protocol.md` again — it is designed to be re-run, and a withdrawal of consent always wins over an earlier grant.
- **Rotate the fingerprint**: `soul-shield/fingerprint.md` explains how to re-issue an identity so an old copy is distinguishable from the current one.

If a Relic was built from someone else's material, their withdrawal of consent is binding regardless of who did the technical work. Delete it.
