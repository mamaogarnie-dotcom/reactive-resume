import { Trans } from "@lingui/react/macro";

import { SectionBase } from "../shared/section-base";

export function InformationSectionBuilder() {
return (
<SectionBase type="information" className="space-y-4">
<div className="space-y-3 rounded-xl border bg-card p-5">
<h4 className="font-medium tracking-tight">
<Trans>About 1story</Trans>
</h4>

<div className="space-y-2 text-muted-foreground text-sm leading-normal">
<p>
<Trans>
1story helps you turn your career history into tailored CVs while keeping you in control of the
final content.
</Trans>
</p>

<p>
<Trans>
Use the builder to review, refine, preview, and export the CV created from your Master Profile.
</Trans>
</p>
</div>
</div>
</SectionBase>
);
}