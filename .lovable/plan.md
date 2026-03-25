

# Move 4 Document Slots from Required to Conditional ("If Available")

## What Changes

Move these 4 documents from the "Required" section to the "Additional (If Available)" section in the document upload UI:

1. Father's foreign passport copy
2. Mother's foreign passport copy
3. Death certificate copy
4. Diploma supplement copy

## File: `src/components/student/DocumentUpload.tsx`

### 1. Remove from `requiredDocuments` array (lines 91-95, 104-109, 146-152, 153-159)

Remove these 4 entries from the `requiredDocuments` array:
- `father_foreign_passport` (lines 91-96)
- `mother_foreign_passport` (lines 104-110)
- `death_certificate` (lines 146-152)
- `diploma_supplement` (lines 153-159)

### 2. Add to `conditionalDocuments` array (lines 202-224)

Add the same 4 entries into the `conditionalDocuments` array with an "if available" note:

```
{ id: 'father_foreign_passport', ..., note: "If available" }
{ id: 'mother_foreign_passport', ..., note: "If available" }
{ id: 'death_certificate', ..., note: "If applicable" }
{ id: 'diploma_supplement', ..., note: "If available" }
```

### 3. Move translation slots

Move the corresponding 4 entries from `translationSlots` (lines 167, 169, 175-176) to `conditionalTranslationSlots` (lines 180-199).

### Summary

- Required documents: 13 -> 9
- Conditional documents: 3 -> 7
- No database changes needed -- document IDs stay the same, existing uploads remain intact

