export interface NewSnippet {
  title: string;
  description: string;
  language: string;
  code: string;
  docs: string;
  isPinned: boolean;
  tags: string[];
}

export interface Snippet extends NewSnippet {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagCount {
  count: number;
  name: string;
}

export interface SearchQuery {
  query: string;
  tags: string[];
  languages: string[];
}
