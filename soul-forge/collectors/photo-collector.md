# Photo Collector

> “照片会撒谎角度，但很少会撒谎习惯；谁总在窗边，谁总把碗摆正，镜头比我们记得更牢。”
> *Photos lie about angles, but rarely about habits — who's always by the window, who always lines up the bowls; the lens remembers better than we do.*

## Supported Formats

| Data Type | Supported Forms | Common Files | Notes |
|---|---|---|---|
| Single photos | originals, compressed, screenshots | `.jpg` `.jpeg` `.png` `.webp` | screenshots need a source mark to avoid misjudging capture time |
| Album exports | phone albums, shared albums, cloud album exports | folders, archives, album index files | suited to timeline clustering |
| HEIC/HEIF (extra dependency) | phone photo stills | `.heic` `.heif` | requires `pillow-heif`; the default environment does not claim native support |
| Captioned photos | images with text descriptions, or social-media exports | image + caption | captions serve as auxiliary evidence for scene interpretation |

The current version by default supports **EXIF metadata extraction only**; other visual-understanding capabilities require extra model support.

Two information types are involved:

- **EXIF metadata**: capture time, device, focal length, precise GPS coordinates; sanitize location before structured output.
- **AI capabilities like scene recognition**: location type, human actions, object placement, lighting atmosphere, recurring life elements; **requires extra model support; not enabled by default in the current version.**

## Collection Flow

1. **Receive originals and source notes**
   - Record image source, whether original, whether filtered or re-edited.
   - If from a chat screenshot, keep the original context source.

2. **Extract EXIF metadata**
   - Read capture time, device model, lens params, precise GPS coordinates; sanitize to city, district, or venue level before external output.
   - For images missing EXIF, supplement clues from file time, album order, or captions.

3. **Time clustering and optional scene clustering**
   - The current version can organize photo groups by same day, same location, same event.
   - Scene clustering based on visual content requires extra model support; burst shots and near-duplicates merge first.

4. **Scene recognition (requires extra model support)**
   - Recognize actions, environment, common objects, companions, and spatial arrangement in photos.
   - Not enabled by default in the current version; if enabled, focus on details that reflect habits and emotions — always in the kitchen, often shooting the sky, flowers always at home, desk always tidy.

5. **Connect subject clues**
   - Judge whether the target is directly in frame, indirectly pointed to, or present through their objects and environment.
   - Photos where "the subject isn't in frame but the traces are strong" can also enter as `artifact` evidence.

6. **Export structured results**
   - Produce photo-group summary, metadata summary, and privacy-handling notes; if extra models are enabled, add scene features.
   - Hand to behavior, emotion, and other dimensions for continued extraction.

## Cleaning Rules

- Merge burst shots, blurry duplicates, and near-identical angles — keep the group that best illustrates the point.
- Preserve original capture time; without EXIF, write explicitly "time inferred from file order or caption."
- Edited images must be marked "filter/crop/collage" — don't treat reprocessing as the original scene.
- If extra-model scene recognition is enabled, state the certainty level; never hard-judge ambiguous images into persona traits.
- Do not infer sensitive attributes from photos — medical status, religion, income, political stance.
- High-sensitivity elements — license plates, door numbers, IDs, children's faces — are hidden or excluded from output summaries.
- If caption and image conflict, keep both and hand to the contradiction module for labeling.

## Privacy Protection

- EXIF GPS may contain precise coordinates; structured output should sanitize to coarse location, e.g. "a residential area in Shanghai," "a seaside city park."
- Unrelated third-party faces are not expanded in structured results.
- Sensitive furnishings in family spaces — bills, medicine boxes, school info — do not go directly into public summaries.
- Albums are extracted by minimum-necessary principle; don't cram an entire photo library into one awakening.
- If the user only wants on-the-spot analysis, intermediate image index files may be deleted after results are confirmed.

## Output Format

```yaml
collector: photo
sources:
  - 手机相册导出 / phone album export
  - 聊天中的单张照片 / single photos from chats
photo_groups:
  - group_id: 照片组编号 / photo group ID
    time_window:
      start: 该组开始时间 / group start
      end: 该组结束时间 / group end
    location_hint: 已脱敏的粗粒度地点描述 / sanitized coarse location
    exif:
      captured_at: 关键拍摄时间 / key capture time
      device: 设备信息 / device info
      geo: 已脱敏的位置说明（不要直接输出原始 GPS 坐标） / sanitized location (never raw GPS)
    target_presence: 直接出镜 | 间接指向 | 未出镜但痕迹明确 / in frame | indirectly pointed | absent but strongly traced
    scene_summary: 对环境、动作、物件与氛围的摘要（需额外模型支持） / summary of environment, action, objects, atmosphere (needs extra model)
    visible_actions:
      - 照片中可见的动作或重复行为（需额外模型支持） / visible or repeated actions (needs extra model)
    emotional_clues:
      - 能支持情绪或关系判断的线索（需额外模型支持） / clues supporting emotion or relationship judgment (needs extra model)
    evidence:
      - level: artifact
        source: 照片组来源说明 / photo group source note
        excerpt: 该组最关键的一张或一类画面说明 / the key frame(s) description
quality_notes:
  - EXIF 缺失、场景不清晰、二次编辑等说明 / missing EXIF, unclear scenes, re-editing notes
handoff:
  likely_dimensions:
    - behavior
    - emotion
```
