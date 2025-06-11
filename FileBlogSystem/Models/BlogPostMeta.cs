using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace FileBlogSystem.Models
{
    public class BlogPostMeta
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        [JsonPropertyName("PublishedDate")]
        public DateTime PublishedDate { get; set; }

        [JsonPropertyName("ModificationDate")]
        public DateTime ModificationDate { get; set; }

        public List<string> Tags { get; set; } = new List<string>();
        public List<string> Categories { get; set; } = new List<string>();

        [JsonPropertyName("CustomUrl")]
        public string? CustomUrl { get; set; } // Nullable because it might not always be defined

        [JsonIgnore]
        public string? Slug { get; set; }

        [JsonIgnore]
        public string? ContentFilePath { get; set; }
        [JsonIgnore]
        public string? PostFolderPath { get; set; }
        [JsonPropertyName("isDraft")] 
        public bool IsDraft { get; set; }
        [JsonIgnore] 
        public string Content { get; set; } = string.Empty;

    }
}