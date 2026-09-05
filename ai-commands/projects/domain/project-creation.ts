import * as fs from 'node:fs';
import * as path from 'node:path';

export type ProjectMetadataValue = string | string[];

export type ProjectLyricsSource = 'write' | 'ready-to-post';
export type ProjectCoverMode = 'video' | 'static-picture';
export type ProjectThumbnailMode = 'same-as-cover' | 'separate';

export interface ProjectMultimediaSettings {
  lyricsSource: ProjectLyricsSource;
  coverMode: ProjectCoverMode;
  thumbnailMode: ProjectThumbnailMode;
}

export interface CreateProjectEntityInput {
  name: string;
  description?: string;
  specification?: string;
  projectType: string;
  releaseType?: string;
  multimedia?: Partial<ProjectMultimediaSettings>;
}

export interface CreateProjectInput extends CreateProjectEntityInput {
  registryPath: string;
  rootPath: string;
  specFile?: string;
}

export interface CreateProjectOutput {
  id: string;
  name: string;
  path: string;
  specPath: string;
}

export interface ProjectSpecTemplateInput {
  name?: string;
  projectType?: string;
  contentType?: string;
  releaseType?: string;
  multimedia?: Partial<ProjectMultimediaSettings>;
}

export class ProjectEntity {
  private constructor(
    readonly id: string,
    readonly label: string,
    readonly description: string,
    readonly specification: string,
    readonly projectType: string,
    readonly releaseType: string,
    readonly multimedia?: ProjectMultimediaSettings
  ) {}

  static create(input: CreateProjectEntityInput): ProjectEntity {
    const label = input.name.trim();
    const specification = (input.specification || input.description || '').trim();
    const description = (input.description || this.summaryFromSpecification(specification)).trim();
    const projectType = input.projectType.trim();
    const releaseType = (input.releaseType || '').trim();
    if (label.length < 5) {
      throw new Error('Project title must be at least 5 characters.');
    }
    if (specification.length < 15) {
      throw new Error('Project specification must be at least 15 characters.');
    }
    if (!projectType) {
      throw new Error('Project type is required.');
    }
    if (!releaseType) {
      throw new Error('Release type is required.');
    }
    return new ProjectEntity(this.slugId(label), label, description, specification, projectType, releaseType, this.normalizeMultimediaSettings(input.multimedia));
  }

  defaultSpec(): string {
    return this.specification;
  }

  defaultMeta(): string {
    const type = this.releaseType === 'video' || this.releaseType === 'audio' || this.projectType === 'multimedia-channel' ? 'channel' : this.projectType;
    const lines = [
      'type: ' + yamlLooseQuote(type),
      'title: ' + yamlLooseQuote(this.label),
      'summary: ' + yamlLooseQuote(this.description),
      'content_type: ' + yamlLooseQuote(this.projectType),
      'release_type: ' + yamlLooseQuote(this.releaseType)
    ];
    if (this.multimedia) {
      lines.push(
        'lyrics_source: ' + yamlLooseQuote(this.multimedia.lyricsSource),
        'cover_mode: ' + yamlLooseQuote(this.multimedia.coverMode),
        'thumbnail_mode: ' + yamlLooseQuote(this.multimedia.thumbnailMode)
      );
    }
    lines.push('released: false', '');
    return lines.join('\n');
  }

  private static summaryFromSpecification(specification: string): string {
    const firstMeaningfulLine = specification.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith('#') && !line.startsWith('- [ ]'));
    return firstMeaningfulLine || 'Project specification pending.';
  }

  private static normalizeMultimediaSettings(input?: Partial<ProjectMultimediaSettings>): ProjectMultimediaSettings | undefined {
    if (!input) {
      return undefined;
    }
    const lyricsSource = input.lyricsSource === 'ready-to-post' ? 'ready-to-post' : 'write';
    const coverMode = input.coverMode === 'static-picture' ? 'static-picture' : 'video';
    const thumbnailMode = input.thumbnailMode === 'separate' ? 'separate' : 'same-as-cover';
    return { lyricsSource, coverMode, thumbnailMode };
  }

  private static slugId(value: string): string {
    return slugifyProjectName(value);
  }
}

export function createProjectSpecTemplate(input: ProjectSpecTemplateInput): string {
  const name = (input.name || '').trim() || 'TODO: Project title';
  const contentType = (input.contentType || input.projectType || '').trim() || 'song';
  const releaseType = (input.releaseType || '').trim() || 'video';
  const lyricsSource = input.multimedia?.lyricsSource || 'write';
  const coverMode = input.multimedia?.coverMode || 'video';
  const thumbnailMode = input.multimedia?.thumbnailMode || 'same-as-cover';
  return [
    `# ${name}`,
    '',
    '## Specification',
    '',
    'TODO: Describe the creative goal, audience, language, mood, and final deliverable.',
    '',
    '## Release',
    '',
    `- Type: ${contentType}`,
    `- Release type: ${releaseType}`,
    '- Workflow: multimedia',
    '',
    '## Lyrics',
    '',
    `- Source: ${lyricsSource}`,
    '- TODO: Paste final lyrics or describe what should be written.',
    '',
    '## Visuals',
    '',
    `- Cover: ${coverMode}`,
    `- Thumbnail: ${thumbnailMode}`,
    '- TODO: Describe cover image/video direction, palette, composition, and any required text.',
    '',
    '## Audio',
    '',
    'TODO: Describe voice, music style, instrumentation, tempo, and mix references.',
    '',
    '## Scene',
    '',
    'TODO: Describe scene structure, shot list, animation notes, or static visual treatment.',
    '',
    '## Files',
    '',
    '- scene/',
    '- out/',
    '- lyrics/',
    '- audio/',
    '',
    '## Notes',
    '',
    'TODO: Add constraints, references, approvals, or publishing requirements.',
    ''
  ].join('\n');
}

export function createProject(input: CreateProjectInput): CreateProjectOutput {
  const specification = input.specification?.trim()
    ? input.specification
    : input.specFile && fs.existsSync(input.specFile)
      ? fs.readFileSync(input.specFile, 'utf8')
      : input.specification;
  const entity = ProjectEntity.create({ ...input, specification });
  const registryPath = path.resolve(input.registryPath);
  const rootPath = path.resolve(input.rootPath);
  const projectPath = path.join(rootPath, entity.id);
  const specPath = path.join(projectPath, 'spec.md');
  if (fs.existsSync(projectPath)) {
    throw new Error(`Project path already exists: ${projectPath}`);
  }
  const registryText = fs.existsSync(registryPath) ? fs.readFileSync(registryPath, 'utf8') : 'projects:\n';
  if (registryHasProject(registryText, entity.id, entity.label)) {
    throw new Error(`Project ${entity.label} already exists in this workflow registry.`);
  }
  fs.mkdirSync(path.join(projectPath, 'scene'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'out'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'lyrics'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'audio'), { recursive: true });
  if (input.specFile && fs.existsSync(input.specFile)) {
    fs.copyFileSync(input.specFile, specPath);
  } else if (input.specification?.trim()) {
    fs.writeFileSync(specPath, entity.defaultSpec(), 'utf8');
  } else {
    fs.writeFileSync(specPath, createProjectSpecTemplate({
      name: entity.label,
      contentType: entity.projectType,
      releaseType: entity.releaseType,
      multimedia: entity.multimedia
    }), 'utf8');
  }
  fs.writeFileSync(path.join(projectPath, 'meta.yml'), projectMetaYaml(entity), 'utf8');
  fs.mkdirSync(path.dirname(registryPath), { recursive: true });
  fs.writeFileSync(registryPath, appendProjectRegistryItem(registryText, entity, projectPath, specPath), 'utf8');
  return {
    id: entity.id,
    name: entity.label,
    path: projectPath,
    specPath
  };
}

function projectMetaYaml(entity: ProjectEntity): string {
  const lines = [
    `id: ${yamlQuote(entity.id)}`,
    `name: ${yamlQuote(entity.label)}`,
    `type: ${yamlQuote(entity.projectType)}`,
    `release_type: ${yamlQuote(entity.releaseType)}`,
    'spec_file: "spec.md"',
    'directories:',
    '  scene: "scene"',
    '  out: "out"',
    '  lyrics: "lyrics"',
    '  audio: "audio"'
  ];
  if (entity.multimedia) {
    lines.push(
      'multimedia:',
      `  lyrics_source: ${yamlQuote(entity.multimedia.lyricsSource)}`,
      `  cover_mode: ${yamlQuote(entity.multimedia.coverMode)}`,
      `  thumbnail_mode: ${yamlQuote(entity.multimedia.thumbnailMode)}`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function appendProjectRegistryItem(registryText: string, entity: ProjectEntity, projectPath: string, specPath: string): string {
  let text = registryText.trimEnd();
  if (!/^projects:\s*$/m.test(text)) {
    text = text ? `${text}\nprojects:` : 'projects:';
  }
  return [
    text,
    `  - id: ${yamlQuote(entity.id)}`,
    `    label: ${yamlQuote(entity.label)}`,
    `    name: ${yamlQuote(entity.label)}`,
    `    path: ${yamlQuote(projectPath)}`,
    `    repo_path: ${yamlQuote(projectPath)}`,
    '    workflow: "multimedia"',
    `    project_type: ${yamlQuote(entity.projectType)}`,
    `    release_type: ${yamlQuote(entity.releaseType)}`,
    `    doc_path: ${yamlQuote(specPath)}`,
    ''
  ].join('\n');
}

function registryHasProject(registryText: string, id: string, label: string): boolean {
  const escapedId = escapeRegex(id);
  const escapedLabel = escapeRegex(label);
  return new RegExp(`^[\\s-]*id:\\s*['"]?${escapedId}['"]?\\s*$`, 'm').test(registryText)
    || new RegExp(`^[\\s-]*label:\\s*['"]?${escapedLabel}['"]?\\s*$`, 'm').test(registryText);
}

function slugifyProjectName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

function yamlQuote(value: string): string {
  return JSON.stringify(value.trim());
}

function yamlLooseQuote(value: string): string {
  const normalized = value.trim();
  if (/^[A-Za-z0-9_./:@ -]+$/.test(normalized) && !normalized.includes('#')) {
    return normalized;
  }
  return JSON.stringify(normalized);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
