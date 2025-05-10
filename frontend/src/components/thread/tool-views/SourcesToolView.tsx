import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  FileImage, 
  FileVideo, 
  Globe, 
  Users, 
  GraduationCap,
  ChevronDown, 
  Twitter, 
  Search, 
  X,
  ExternalLink,
  Copy,
  LinkIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Definição de tipos para as fontes
interface Source {
  url: string;
  title: string;
  type: "link" | "image" | "video" | "social" | "community" | "academic";
  description?: string;
  timestamp?: string;
  category?: string;
}

// Interface para estatísticas das fontes
interface SourceStats {
  total: number;
  byCategory: Record<string, number>;
}

// Chave base para armazenamento no localStorage
const STORAGE_KEY_BASE = "laker_sources_data";

// Função para obter a chave de armazenamento específica para o thread atual
function getStorageKey(threadId?: string): string {
  if (!threadId) return STORAGE_KEY_BASE;
  return `${STORAGE_KEY_BASE}_${threadId}`;
}

// Função para carregar fontes do localStorage específicas para um thread
function loadSourcesFromStorage(threadId?: string): Source[] {
  if (typeof window === "undefined") return [];
  
  try {
    const storageKey = getStorageKey(threadId);
    const storedData = localStorage.getItem(storageKey);
    if (!storedData) return [];
    
    const parsedData = JSON.parse(storedData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch (error) {
    console.error("Erro ao carregar fontes do localStorage:", error);
    return [];
  }
}

// Função para salvar fontes no localStorage
function saveSourcesToStorage(sources: Source[], threadId?: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const storageKey = getStorageKey(threadId);
    localStorage.setItem(storageKey, JSON.stringify(sources));
  } catch (error) {
    console.error("Erro ao salvar fontes no localStorage:", error);
  }
}

// Função para limpar URLs, removendo caracteres problemáticos
function cleanUrl(url: string): string {
  return url.replace(/\\+/g, '');
}

// Helper function to extract YouTube video ID from URL
function getYoutubeVideoId(url: string): string | null {
  if (!url) return null;
  
  // Limpar URL de caracteres de escape primeiro
  const cleanedUrl = cleanUrl(url);
  
  // Limpar possíveis parametros adicionais
  const urlWithoutParams = cleanedUrl.split('&')[0];
  
  // Padrões comuns de URLs do YouTube
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/watch\?v=)([^&]+)/i,
    /(?:youtu\.be\/)([^?]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = urlWithoutParams.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Se não encontrou com os padrões padrão, tenta uma abordagem mais flexível
  const anyYoutubeId = cleanedUrl.match(/(?:v=|\/)([\w-]{11})(?:\?|&|\/|$)/);
  if (anyYoutubeId && anyYoutubeId[1]) {
    return anyYoutubeId[1];
  }
  
  return null;
}

// Função para verificar se uma URL é do YouTube
function isYoutubeUrl(url: string): boolean {
  return url.includes('youtube.com') || url.includes('youtu.be');
}

// Função para categorizar fontes com base na URL
function categorizeSource(source: Source): Source {
  const url = source.url.toLowerCase();
  let category = "web"; // Categoria padrão
  let type = source.type;
  
  // Determinar tipo baseado na URL
  if (source.type === "video" || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo") || url.match(/\.(mp4|mov|webm|avi)$/i)) {
    type = "video";
    category = "videos";
  } else if (source.type === "image" || url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
    type = "image";
    category = "imagens";
  } else if (url.includes("twitter.com") || url.includes("x.com") || url.includes("facebook.com") || url.includes("instagram.com") || 
            url.includes("linkedin.com") || url.includes("tiktok.com") || 
            url.match(/social|profile|user/i)) {
    type = "social";
    category = "social";
  } else if (url.includes("forum") || url.includes("community") || url.includes("reddit.com") || 
            url.includes("stackoverflow.com") || url.includes("discourse") || 
            url.match(/forum|community|group|discussion/i)) {
    type = "community";
    category = "comunidade";
  } else if (url.includes("scholar.google") || url.includes("doi.org") || url.includes("arxiv.org") ||
            url.includes("sciencedirect.com") || url.includes("researchgate.net") || url.includes("academia.edu") ||
            url.match(/journal|paper|research|doi|abstract|proceedings|scholar/i)) {
    type = "academic";
    category = "academic";
  } else {
    type = "link";
    category = "web";
  }
  
  return { ...source, type: type as any, category };
}

interface SourcesToolViewProps {
  name: string;
  assistantContent: string;
  toolContent: string;
  assistantTimestamp: string;
  toolTimestamp: string;
  isSuccess: boolean;
  isStreaming: boolean;
  threadId?: string;
}

export const SourcesToolView: React.FC<SourcesToolViewProps> = ({
  name,
  assistantContent,
  toolContent,
  assistantTimestamp,
  toolTimestamp,
  isSuccess,
  isStreaming,
  threadId
}) => {
  // Estado para armazenar as fontes
  const [sources, setSources] = useState<Source[]>([]);
  // Estado para armazenar a aba ativa
  const [activeTab, setActiveTab] = useState("todos");
  // Estado para armazenar o termo de busca
  const [searchTerm, setSearchTerm] = useState("");
  // Estado para controlar a exibição da barra de busca
  const [showSearch, setShowSearch] = useState(false);
  
  // Carrega as fontes existentes do localStorage ao inicializar
  useEffect(() => {
    const storedSources = loadSourcesFromStorage(threadId);
    setSources(storedSources);
  }, [threadId]);
  
  // Processa o conteúdo da ferramenta para extrair fontes
  useEffect(() => {
    if (!toolContent || isStreaming) return;

    // Tentar diferentes estratégias de extração
    let newSources: Source[] = [];
    let extracted = false;
    
    try {
      // Estratégia 1: Tentar fazer parse direto como JSON
      const jsonContent = JSON.parse(toolContent);
      
      // Verificar se o objeto contém uma propriedade 'source' (add_source)
      if (jsonContent.source) {
        newSources = [categorizeSource(jsonContent.source)];
        extracted = true;
      }
      // Verificar se o objeto contém uma propriedade 'sources' (extract_sources)
      else if (jsonContent.sources && Array.isArray(jsonContent.sources)) {
        newSources = jsonContent.sources.map(categorizeSource);
        extracted = true;
      }
      // Verificar o formato "success": true no resultado ToolResult
      else if (jsonContent.success === true) {
        if (jsonContent.source) {
          newSources = [categorizeSource(jsonContent.source)];
          extracted = true;
        } else if (jsonContent.sources && Array.isArray(jsonContent.sources)) {
          newSources = jsonContent.sources.map(categorizeSource);
          extracted = true;
        }
      }
    } catch (e) {
      console.log("Não foi possível extrair como JSON puro", e);
    }
    
    // Caso especial para o formato "ToolResult(success=True, output={...})"
    if (!extracted && typeof toolContent === 'string' && toolContent.includes('ToolResult(success=True, output=')) {
      try {
        // Extrair o objeto de saída usando regex
        const outputMatch = toolContent.match(/output=({[\s\S]*?})\)/);
        if (outputMatch && outputMatch[1]) {
          // Converter a string do objeto para um objeto JSON válido
          let jsonStr = outputMatch[1]
            .replace(/'/g, '"')                 // Substitui aspas simples por duplas
            .replace(/(\w+):/g, '"$1":')        // Adiciona aspas aos nomes das propriedades
            .replace(/"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+)"/g, '"$1"'); // Mantém formato de data
          
          try {
            const outputObj = JSON.parse(jsonStr);
            newSources = [categorizeSource(outputObj)];
            extracted = true;
          } catch (jsonError) {
            // Tentativa de extração manual em caso de falha
            const url = toolContent.match(/'url':\s*'([^']+)'/)?.[1];
            const title = toolContent.match(/'title':\s*'([^']+)'/)?.[1];
            const type = toolContent.match(/'type':\s*'([^']+)'/)?.[1];
            const description = toolContent.match(/'description':\s*'([^']+)'/)?.[1];
            
            if (url) {
              newSources = [{
                url,
                title: title || "Untitled Source",
                type: (type as any) || "link",
                description: description || "",
                timestamp: new Date().toISOString()
              }];
              extracted = true;
            }
          }
        }
      } catch (e) {
        console.error("Erro ao processar ToolResult:", e);
      }
    }
    
    // Estratégia 2: Tentar extrair de tags XML
    if (!extracted && typeof toolContent === 'string') {
      // Tentar extrair de <tool_result>
      const toolResultMatch = toolContent.match(/<tool_result>([\s\S]*?)<\/tool_result>/);
      if (toolResultMatch && toolResultMatch[1]) {
        try {
          const resultContent = toolResultMatch[1].trim();
          // Tentar extrair como JSON
          try {
            const jsonContent = JSON.parse(resultContent);
            if (jsonContent.source) {
              newSources = [categorizeSource(jsonContent.source)];
              extracted = true;
            } else if (jsonContent.sources && Array.isArray(jsonContent.sources)) {
              newSources = jsonContent.sources.map(categorizeSource);
              extracted = true;
            }
          } catch (jsonError) {
            // Tentar extrair de <add-source> tags aninhadas
            const sourceMatches = resultContent.match(/<add-source[^>]*>([\s\S]*?)<\/add-source>/g);
            if (sourceMatches && sourceMatches.length > 0) {
              newSources = sourceMatches.map(sourceTag => {
                const urlMatch = sourceTag.match(/url="([^"]+)"/);
                const titleMatch = sourceTag.match(/title="([^"]+)"/);
                const typeMatch = sourceTag.match(/type="([^"]+)"/);
                const descriptionMatch = sourceTag.match(/>([^<]+)</);
                
                return categorizeSource({
                  url: urlMatch ? urlMatch[1] : "",
                  title: titleMatch ? titleMatch[1] : "Untitled Source",
                  type: (typeMatch ? typeMatch[1] : "link") as any,
                  description: descriptionMatch ? descriptionMatch[1].trim() : "",
                  timestamp: new Date().toISOString()
                });
              });
              extracted = true;
            }
          }
        } catch (e) {
          console.error("Erro ao processar conteúdo de tool_result:", e);
        }
      }
      
      // Tentar extrair de <add-source> ou <extract-sources> diretamente
      if (!extracted) {
        const sourceMatch = toolContent.match(/<add-source[^>]*>([\s\S]*?)<\/add-source>/);
        if (sourceMatch) {
          const urlMatch = toolContent.match(/url="([^"]+)"/);
          const titleMatch = toolContent.match(/title="([^"]+)"/);
          const typeMatch = toolContent.match(/type="([^"]+)"/);
          const descriptionMatch = sourceMatch[1].trim();
          
          if (urlMatch) {
            newSources = [categorizeSource({
              url: urlMatch[1],
              title: titleMatch ? titleMatch[1] : "Untitled Source",
              type: (typeMatch ? typeMatch[1] : "link") as any,
              description: descriptionMatch || "",
              timestamp: new Date().toISOString()
            })];
            extracted = true;
          }
        }
      }
    }
    
    // Estratégia 3: Extrair URLs diretamente do texto se tudo mais falhar
    if (!extracted && typeof toolContent === 'string' && !toolContent.includes('<')) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = toolContent.match(urlRegex);
      
      if (matches && matches.length > 0) {
        newSources = matches.map(url => {
          return categorizeSource({
            url: url.replace(/[.,;:'"!?)]$/g, ''), // Remove possíveis pontuações no final da URL
            title: "URL encontrado",
            type: "link",
            description: "Extraído automaticamente do texto",
            timestamp: new Date().toISOString()
          });
        });
        extracted = true;
      }
    }
    
    // Se encontrou novas fontes, adiciona-as ao estado e localStorage
    if (extracted && newSources.length > 0) {
      setSources(prevSources => {
        // Verificar duplicatas comparando URLs
        const existingUrls = new Set(prevSources.map(s => s.url));
        const uniqueNewSources = newSources.filter(s => !existingUrls.has(s.url));
        
        // Só adicionar se houver novas fontes únicas
        if (uniqueNewSources.length > 0) {
          const updatedSources = [...prevSources, ...uniqueNewSources];
          // Salvar no localStorage
          saveSourcesToStorage(updatedSources, threadId);
          return updatedSources;
        }
        
        return prevSources;
      });
    }
  }, [toolContent, isStreaming, threadId]);
  
  // Filtrar fontes com base no termo de busca e na aba ativa
  const filteredSources = sources.filter(source => {
    // Filtrar por termo de busca
    const searchMatch = !searchTerm || 
      source.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      source.url.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtrar por categoria/aba
    const categoryMatch = activeTab === "todos" || 
      source.category === activeTab ||
      source.type === activeTab;
    
    return searchMatch && categoryMatch;
  });
  
  // Calcular estatísticas para as abas
  const stats: SourceStats = {
    total: sources.length,
    byCategory: sources.reduce((acc, source) => {
      const category = source.category || "outro";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
  
  // Definir as abas disponíveis com base nas categorias existentes
  const tabs = [
    { id: "todos", label: "Todos", icon: <Globe className="w-3 h-3" />, count: sources.length },
    { id: "web", label: "Links", icon: <LinkIcon className="w-3 h-3" />, count: stats.byCategory["web"] || 0 },
    { id: "videos", label: "Vídeos", icon: <FileVideo className="w-3 h-3" />, count: stats.byCategory["videos"] || 0 },
    { id: "imagens", label: "Imagens", icon: <FileImage className="w-3 h-3" />, count: stats.byCategory["imagens"] || 0 },
    { id: "social", label: "Social", icon: <Twitter className="w-3 h-3" />, count: stats.byCategory["social"] || 0 },
    { id: "comunidade", label: "Comunidade", icon: <Users className="w-3 h-3" />, count: stats.byCategory["comunidade"] || 0 },
    { id: "academic", label: "Acadêmico", icon: <GraduationCap className="w-3 h-3" />, count: stats.byCategory["academic"] || 0 }
  ];
  
  // Se não houver fontes, exibe mensagem
  if (sources.length === 0) {
    return (
      <div className="p-4 text-zinc-500 dark:text-zinc-400 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="h-4 w-4" />
          <span className="font-medium">Fontes</span>
        </div>
        <p>Nenhuma fonte encontrada para este thread.</p>
      </div>
    );
  }
  
  // Copiar URL para a área de transferência
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Poderia adicionar uma notificação de sucesso aqui
        console.log("URL copiada para a área de transferência");
      })
      .catch(err => {
        console.error("Erro ao copiar URL:", err);
      });
  };
  
  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <h3 className="font-medium">Fontes ({sources.length})</h3>
          </div>
          
          <div className="flex items-center gap-1">
            {showSearch ? (
              <div className="flex items-center border rounded-md dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar fontes..."
                  className="text-xs px-2 py-1 w-40 bg-transparent focus:outline-none"
                />
                <button 
                  onClick={() => {
                    setSearchTerm("");
                    setShowSearch(false);
                  }}
                  className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowSearch(true)}
                className="p-1 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 rounded-md"
              >
                <Search className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Abas para as categorias - Design mais moderno e compacto */}
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-1 mb-3 overflow-x-auto flex items-center">
        <div className="flex w-full">
          {tabs.filter(tab => tab.count > 0 || tab.id === "todos").map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1 transition-all duration-200 px-2 py-1.5 text-xs rounded-md flex-1 justify-center",
                activeTab === tab.id
                  ? "bg-white dark:bg-zinc-800 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span className={cn(
                  "text-[10px] min-w-[16px] h-4 flex items-center justify-center rounded-full",
                  activeTab === tab.id
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Lista de fontes */}
      <div className="space-y-3">
        {filteredSources.length === 0 ? (
          <div className="text-center py-4 text-zinc-500 dark:text-zinc-400 text-sm">
            Nenhuma fonte encontrada para os filtros aplicados.
          </div>
        ) : (
          filteredSources.map((source, index) => (
            <div 
              key={`${source.url}-${index}`} 
              className="border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden bg-white dark:bg-zinc-800 transition-all hover:shadow-sm"
            >
              <div className="p-3">
                {/* Cabeçalho da fonte com ícone e link */}
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1">
                    <a 
                      href={source.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 group"
                    >
                      {source.title}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                    
                    {/* Mostrar domínio da URL */}
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                      {(() => {
                        try {
                          const url = new URL(source.url);
                          return url.hostname.replace('www.', '');
                        } catch (e) {
                          return source.url.split('/')[2] || source.url;
                        }
                      })()}
                      
                      {/* Botões de ação */}
                      <div className="flex items-center gap-0.5 ml-1">
                        <button 
                          onClick={() => copyToClipboard(source.url)}
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title="Copiar URL"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <a 
                          href={source.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title="Abrir em nova aba"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {/* Ícone indicativo do tipo de fonte */}
                  <div className={cn(
                    "p-1 rounded-full",
                    source.type === "video" ? "text-red-500 bg-red-50 dark:bg-red-900/20" : 
                    source.type === "image" ? "text-purple-500 bg-purple-50 dark:bg-purple-900/20" : 
                    source.type === "social" ? "text-blue-500 bg-blue-50 dark:bg-blue-900/20" :
                    source.type === "community" ? "text-green-500 bg-green-50 dark:bg-green-900/20" :
                    source.type === "academic" ? "text-amber-500 bg-amber-50 dark:bg-amber-900/20" :
                    "text-zinc-500 bg-zinc-50 dark:bg-zinc-700/50"
                  )}>
                    {source.type === "video" ? <FileVideo className="w-3 h-3" /> :
                     source.type === "image" ? <FileImage className="w-3 h-3" /> :
                     source.type === "social" ? <Twitter className="w-3 h-3" /> :
                     source.type === "community" ? <Users className="w-3 h-3" /> :
                     source.type === "academic" ? <GraduationCap className="w-3 h-3" /> :
                     <Globe className="w-3 h-3" />}
                  </div>
                </div>
                
                {/* Descrição da fonte, se houver */}
                {source.description && (
                  <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 line-clamp-2">
                    {source.description}
                  </div>
                )}
                
                {/* Exibir imagem se for do tipo imagem */}
                {source.type === "image" && (
                  <div className="mt-2 border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden">
                    <img 
                      src={source.url} 
                      alt={source.title} 
                      className="w-full h-auto max-h-64 object-contain"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        // Mostrar uma mensagem de erro
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          const errorMsg = document.createElement('div');
                          errorMsg.className = "flex items-center justify-center p-4 text-xs text-zinc-500 dark:text-zinc-400";
                          errorMsg.innerHTML = '<span>Não foi possível carregar a imagem</span>';
                          parent.appendChild(errorMsg);
                        }
                      }}
                    />
                  </div>
                )}
                
                {/* Exibir vídeo se for do tipo vídeo ou um link do YouTube */}
                {(source.type === "video" || (source.type === "link" && isYoutubeUrl(source.url))) && (
                  <div className="mt-2 border border-zinc-200 dark:border-zinc-700 rounded-md overflow-hidden">
                    {(() => {
                      const videoId = getYoutubeVideoId(source.url);
                      console.log("Vídeo detectado:", source.url, "ID:", videoId);
                      
                      return videoId ? (
                        <div className="aspect-video w-full">
                          <iframe 
                            width="100%" 
                            height="100%" 
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title={source.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowFullScreen
                            className="border-0"
                            loading="lazy"
                          ></iframe>
                        </div>
                      ) : (
                        <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <FileVideo className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                          <span className="text-xs ml-2 text-zinc-500 dark:text-zinc-400">
                            Vídeo não pode ser incorporado. Clique no link acima para assistir.
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
