import re
import json
import aiohttp
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv
from bs4 import BeautifulSoup
from agent.tools.data_providers.base import Tool
from utils.logger import logger
from utils.openapi_schema import openapi_schema
from utils.xml_schema import xml_schema
from datetime import datetime


class SourcesTool(Tool):
    """Tool for saving and managing sources like links, images, and videos."""

    def __init__(self):
        super().__init__()
        # Load environment variables
        load_dotenv()

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "add_source",
            "description": "Add a source (link, image, or video) to the current thread. This tool allows you to save references to web content that can be displayed in the thread's sources section.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The URL of the source to add (webpage, image, or video URL)."
                    },
                    "title": {
                        "type": "string",
                        "description": "A descriptive title for the source. If not provided, the system will attempt to extract one from the URL."
                    },
                    "type": {
                        "type": "string",
                        "description": "The type of the source: 'link', 'image', or 'video'.",
                        "enum": ["link", "image", "video"],
                        "default": "link"
                    },
                    "description": {
                        "type": "string",
                        "description": "Optional description of the source content."
                    }
                },
                "required": ["url"]
            }
        }
    })
    @xml_schema(
        tag_name="add-source",
        mappings=[
            {"param_name": "url", "node_type": "attribute", "path": "."},
            {"param_name": "title", "node_type": "attribute", "path": "."},
            {"param_name": "type", "node_type": "attribute", "path": "."},
            {"param_name": "description", "node_type": "text", "path": "."}
        ],
        example='''<add-source url="https://example.com/video" title="Example Video" type="video">Description text</add-source>'''
    )
    async def add_source(self, url: str, title: Optional[str] = None, 
                        type: str = "link", description: Optional[str] = None) -> Dict[str, Any]:
        """
        Adds a source (link, image, or video) to the current thread.
        
        Implementation:
        1. Validates the URL and type provided
        2. Auto-detects the media type based on the URL if not specified
        3. Creates a structured source object with metadata
        4. Returns the object to be processed by the frontend
        """
        # Basic validation
        if not url:
            return {"success": False, "error": "URL is required"}
        
        # Validate and normalize URL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        # Auto-detect type if not specified or if we can improve it
        if type == "link":
            # Check for video URLs using regex for greater precision
            youtube_patterns = [
                r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)',
                r'youtube\.com\/shorts\/',
                r'youtube\.com\/v\/'
            ]
            
            is_youtube = any(re.search(pattern, url, re.IGNORECASE) for pattern in youtube_patterns)
            
            if is_youtube:
                type = "video"
            # Check for image URLs
            elif url.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')):
                type = "image"
        
        # Generate a title if not provided
        if not title:
            # Extract title from URL
            domain = re.search(r'https?://(?:www\.)?([^/]+)', url)
            if domain:
                domain_name = domain.group(1)
                path = url.split(domain_name, 1)[1] if domain_name in url else ""
                path_parts = path.strip('/').split('/')
                
                if path_parts and path_parts[-1]:
                    # Use the last part of the path, replacing hyphens and underscores with spaces
                    raw_title = path_parts[-1].split('?')[0].split('#')[0]  # Remove query parameters
                    title = ' '.join(word.capitalize() for word in re.sub(r'[-_.]', ' ', raw_title).split())
                else:
                    # Use the domain name if path doesn't provide useful info
                    title = domain_name.split('.')[0].capitalize()
            else:
                title = "Untitled Source"
        
        # Create source object
        source = {
            "url": url,
            "title": title,
            "type": type,
            "description": description or "",
            "timestamp": datetime.now().isoformat()
        }
            
        # Try to fetch metadata for link types to enhance the source data
        if type == "link" and not description:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, timeout=5) as response:
                        if response.status == 200:
                            html = await response.text()
                            soup = BeautifulSoup(html, 'html.parser')
                            
                            # Try to get a better title from the page
                            page_title = soup.title.string if soup.title else None
                            if page_title:
                                source["title"] = page_title.strip()
                            
                            # Try to get description from meta tags
                            meta_desc = soup.find('meta', attrs={'name': 'description'}) or \
                                       soup.find('meta', attrs={'property': 'og:description'})
                            if meta_desc and meta_desc.get('content'):
                                source["description"] = meta_desc['content'].strip()
            except Exception as e:
                logger.warning(f"Failed to fetch metadata for URL {url}: {str(e)}")
        
        logger.info(f"Source added: {source['title']} ({source['type']})")
        return {"success": True, "source": source}

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "extract_sources",
            "description": "Extract sources (links, images, videos) from a URL or text content. This allows the agent to automatically find and save relevant sources without manually adding each one.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL of the page to extract sources from."
                    },
                    "content": {
                        "type": "string",
                        "description": "Text content to analyze and extract sources from."
                    },
                    "types": {
                        "type": "array",
                        "items": {
                            "type": "string",
                            "enum": ["link", "image", "video"]
                        },
                        "description": "Types of sources to extract. If not specified, all types will be extracted."
                    }
                }
            }
        }
    })
    @xml_schema(
        tag_name="extract-sources",
        mappings=[
            {"param_name": "url", "node_type": "attribute", "path": "."},
            {"param_name": "content", "node_type": "text", "path": "."},
            {"param_name": "types", "node_type": "attribute", "path": "."}
        ],
        example='''<extract-sources url="https://example.com" types="link,image">Optional content text to extract from</extract-sources>'''
    )
    async def extract_sources(self, url: Optional[str] = None, 
                             content: Optional[str] = None,
                             types: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Extracts sources (links, images, videos) from a URL or text content.
        
        Parameters:
        -----------
        url : str, optional
            URL of the page to extract sources from
        content : str, optional
            Text content to analyze and extract sources from
        types : List[str], optional
            Types of sources to extract (link, image, video)
            
        Returns:
        --------
        Dict[str, Any]
            Result containing list of extracted sources
        """
        # Input validation
        if not url and not content:
            return {"success": False, "error": "Either URL or content must be provided"}
        
        # Normalize types parameter
        if types and isinstance(types, str):
            types = [t.strip().lower() for t in types.split(',')]
        elif not types:
            types = ["link", "image", "video"]
        
        sources = []
        
        # Extract from URL
        if url:
            # Validate and normalize URL
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url
                
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(url, timeout=10) as response:
                        if response.status == 200:
                            html = await response.text()
                            sources.extend(await self._extract_from_html(html, types, base_url=url))
                        else:
                            logger.warning(f"Failed to fetch URL {url}: HTTP {response.status}")
                            return {"success": False, "error": f"Failed to fetch URL: HTTP {response.status}"}
            except Exception as e:
                logger.error(f"Error fetching URL {url}: {str(e)}")
                return {"success": False, "error": f"Error fetching URL: {str(e)}"}
        
        # Extract from content text
        if content:
            # Check if content might be HTML
            if '<html' in content.lower() or '<body' in content.lower():
                # Extract from HTML content
                sources.extend(await self._extract_from_html(content, types))
            else:
                # Extract from plain text
                sources.extend(await self._extract_from_text(content, types))
        
        # Remove duplicates by URL
        unique_sources = []
        seen_urls = set()
        for source in sources:
            if source['url'] not in seen_urls:
                seen_urls.add(source['url'])
                unique_sources.append(source)
        
        logger.info(f"Extracted {len(unique_sources)} unique sources")
        return {
            "success": True, 
            "sources": unique_sources,
            "stats": {
                "total": len(unique_sources),
                "by_type": {
                    "link": len([s for s in unique_sources if s["type"] == "link"]),
                    "image": len([s for s in unique_sources if s["type"] == "image"]),
                    "video": len([s for s in unique_sources if s["type"] == "video"])
                }
            }
        }
    
    async def _extract_from_html(self, html: str, types: List[str], base_url: Optional[str] = None) -> List[Dict[str, Any]]:
        """Extract sources from HTML content."""
        sources = []
        soup = BeautifulSoup(html, 'html.parser')
        page_title = soup.title.string.strip() if soup.title else "Untitled Page"
        
        # Helper function to resolve relative URLs
        def resolve_url(url_to_resolve):
            if not url_to_resolve or url_to_resolve.startswith(('http://', 'https://', 'data:', '#')):
                return url_to_resolve
            elif base_url:
                if url_to_resolve.startswith('/'):
                    # Absolute path on the same domain
                    domain = re.search(r'https?://[^/]+', base_url)
                    if domain:
                        return f"{domain.group(0)}{url_to_resolve}"
                else:
                    # Relative path
                    if base_url.endswith('/'):
                        return f"{base_url}{url_to_resolve}"
                    else:
                        # Remove the last part of the path if it's not a directory
                        base_path = base_url.rsplit('/', 1)[0] if '/' in base_url.split('://', 1)[1] else base_url
                        return f"{base_path}/{url_to_resolve}"
            return None
        
        # Extract links
        if "link" in types:
            for a_tag in soup.find_all('a', href=True):
                href = resolve_url(a_tag['href'])
                if href and not href.startswith(('mailto:', 'tel:', 'javascript:', '#')):
                    title = a_tag.get_text().strip() or f"Link from {page_title}"
                    sources.append({
                        "url": href,
                        "title": title if title else "Untitled Link",
                        "type": "link",
                        "description": "",
                        "timestamp": datetime.now().isoformat()
                    })
        
        # Extract images
        if "image" in types:
            for img_tag in soup.find_all('img', src=True):
                src = resolve_url(img_tag['src'])
                if src and not src.startswith('data:'):
                    alt = img_tag.get('alt', '').strip()
                    title = alt or f"Image from {page_title}"
                    sources.append({
                        "url": src,
                        "title": title if title else "Untitled Image",
                        "type": "image",
                        "description": alt,
                        "timestamp": datetime.now().isoformat()
                    })
        
        # Extract videos
        if "video" in types:
            # YouTube iframes
            for iframe in soup.find_all('iframe', src=True):
                src = iframe['src']
                if any(pattern in src for pattern in ['youtube.com/embed', 'player.vimeo.com']):
                    title = iframe.get('title', '').strip() or f"Video from {page_title}"
                    sources.append({
                        "url": src,
                        "title": title if title else "Untitled Video",
                        "type": "video",
                        "description": "",
                        "timestamp": datetime.now().isoformat()
                    })
            
            # HTML5 video tags
            for video_tag in soup.find_all('video', src=True):
                src = resolve_url(video_tag['src'])
                if src:
                    sources.append({
                        "url": src,
                        "title": video_tag.get('title', '') or f"Video from {page_title}",
                        "type": "video",
                        "description": "",
                        "timestamp": datetime.now().isoformat()
                    })
                    
            # Video source tags
            for source_tag in soup.find_all('source'):
                if source_tag.get('type', '').startswith('video/'):
                    src = resolve_url(source_tag.get('src'))
                    if src:
                        sources.append({
                            "url": src,
                            "title": source_tag.get('title', '') or f"Video from {page_title}",
                            "type": "video",
                            "description": "",
                            "timestamp": datetime.now().isoformat()
                        })
        
        return sources
    
    async def _extract_from_text(self, text: str, types: List[str]) -> List[Dict[str, Any]]:
        """Extract sources from plain text content."""
        sources = []
        
        # URL regex pattern - catches many URL formats
        url_pattern = r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+(?:/[-\w%!.~\'()*+,;=:@/&?=]+)?'
        
        # Find all URLs in the text
        for match in re.finditer(url_pattern, text):
            url = match.group(0)
            
            # Determine the type based on URL patterns
            source_type = "link"  # Default type
            
            # Check for video URLs
            if any(pattern in url.lower() for pattern in ['youtube.com/watch', 'youtu.be/', 'vimeo.com', 'youtube.com/embed']):
                source_type = "video"
            # Check for image URLs
            elif url.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg')):
                source_type = "image"
                
            # Only add if the detected type is in the requested types
            if source_type in types:
                # Extract context around the URL (up to 100 chars before and after)
                start = max(0, match.start() - 100)
                end = min(len(text), match.end() + 100)
                context = text[start:end].strip()
                
                # Create a title from the URL
                domain = re.search(r'https?://(?:www\.)?([^/]+)', url)
                path_parts = url.split('/')
                title_part = path_parts[-1] if len(path_parts) > 3 and path_parts[-1] else domain.group(1) if domain else "Link"
                title = ' '.join(word.capitalize() for word in re.sub(r'[-_.]', ' ', title_part).split('?')[0].split())
                
                sources.append({
                    "url": url,
                    "title": title,
                    "type": source_type,
                    "description": context,
                    "timestamp": datetime.now().isoformat()
                })
        
        return sources
