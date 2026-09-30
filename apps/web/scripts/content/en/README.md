# English text of the PDS and ML courses

`programming-for-data-science.en.json` and `fundamental-of-machine-learning.en.json` hold every
learner-facing string of the two courses in English, keyed by database row id. They were produced
from the Vietnamese originals and written to production with `scripts/i18n-apply-course.ts`.

```bash
tsx scripts/i18n-apply-course.ts <course-slug> content/en/<course-slug>.en.json          # dry run
tsx scripts/i18n-apply-course.ts <course-slug> content/en/<course-slug>.en.json --apply
```

`../vi-backup/*.vi.json` are the Vietnamese texts exactly as they were before the translation. The
apply script is its own undo: run it with a `.vi.json` file to restore Vietnamese.

Ids in these files are production ids, so they apply to production only.

## Do not rerun the older seed scripts against production

`seed-pds-lectures.ts`, `seed-ml-micro.ts`, `seed-ml-labs.ts`, `seed-pds-modules23.ts`,
`seed-review-and-final.ts`, `seed-syllabus.ts` and the two `seed-*-more-questions.ts` scripts still
contain the Vietnamese text and detect "already built" by lesson title. Lesson titles are now English,
so rerunning them would create duplicate Vietnamese lessons next to the English ones. They are the
history of how the content was built; change content through the JSON files above instead.
