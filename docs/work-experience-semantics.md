# Work Experience Semantics

This document explains how the parser treats LinkedIn work experience entries when a profile contains multiple roles at the same organization or separate employment periods with the same company.

## Terms

- **Work Experience**: A continuous period of employment at an organization without breaks working elsewhere. If the person returns to the same company after a break or employment elsewhere, that later period is a separate work experience.
- **Organization/Company**: The employer entity, such as "TechCorp" or "DataSystems Inc".
- **Position/Role**: The job title within that work experience period, such as "Engineering Manager" or "Senior Developer".

## JSON Output Shapes

The parser emits work history in two shapes:

- **`experience_groups`**: the canonical grouped representation. Each entry is one continuous work experience at an organization and contains a `positions` array. Use this when preserving LinkedIn's company grouping, multi-role progressions, or organization-level total duration matters.
- **`experience`**: a flattened compatibility representation. Each entry is one position and repeats the company name on that position. Use this when callers need a simple list of roles and do not need organization grouping.

Both shapes represent the same parsed work history. `experience_groups` preserves the parser's work-experience model, while `experience` is derived from those groups for consumers that already expect the older flat schema.

```json
{
  "experience_groups": [
    {
      "company": "TechCorp",
      "totalDuration": "5 yrs",
      "positions": [
        {
          "title": "Engineering Manager",
          "duration": "2022 - Present"
        },
        {
          "title": "Senior Developer",
          "duration": "2019 - 2022"
        }
      ]
    }
  ],
  "experience": [
    {
      "company": "TechCorp",
      "title": "Engineering Manager",
      "duration": "2022 - Present"
    },
    {
      "company": "TechCorp",
      "title": "Senior Developer",
      "duration": "2019 - 2022"
    }
  ]
}
```

## Single Organization, Multiple Positions

When a person holds multiple consecutive roles at the same organization, those roles belong to one continuous work experience period.

```text
TechCorp (1 work experience, 3 positions):
- Engineering Manager
- Senior Developer
- Software Developer
```

## Same Organization, Separate Work Experiences

When a person returns to the same company after working elsewhere, each employment period is treated as a separate work experience.

```text
DataSystems Inc (2 separate work experiences, 2 positions):
1st work experience: Lead Engineer (2018-2020)
2nd work experience: Technical Architect (2023-Present)
```

The key principle is continuity: if there is a break in employment at an organization because the person worked elsewhere, the later return counts as a separate work experience. This preserves career progression and distinguishes different employment periods.
