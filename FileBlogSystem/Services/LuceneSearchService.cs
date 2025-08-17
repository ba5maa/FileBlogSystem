using FileBlogSystem.Models;
using FileBlogSystem.Services;
using Lucene.Net.Analysis;
using Lucene.Net.Analysis.Standard;
using Lucene.Net.Documents;
using Lucene.Net.Index;
using Lucene.Net.QueryParsers.Classic;
using Lucene.Net.Search;
using Lucene.Net.Store;
using Lucene.Net.Util;
using IO = System.IO;   


public sealed class LuceneSearchService : ILuceneSearchService, IDisposable
{
    private readonly FSDirectory _dir;
    private readonly Analyzer _analyzer;
    private readonly IFileContentService _files; 
    private readonly object _writerLock = new();
    private IndexWriter? _writer;
    private static readonly LuceneVersion AppLuceneVersion = LuceneVersion.LUCENE_48;

    public LuceneSearchService(IWebHostEnvironment env, IFileContentService files, bool useArabic = false)
    {
        var indexPath = Path.Combine(env.ContentRootPath, "content", "index");
        IO.Directory.CreateDirectory(indexPath);
        _dir = FSDirectory.Open(new IO.DirectoryInfo(indexPath));

        _analyzer = new StandardAnalyzer(AppLuceneVersion);

        _files = files;
        _writer = new IndexWriter(_dir, new IndexWriterConfig(AppLuceneVersion, _analyzer));
    }

    public async Task RebuildIndexAsync(CancellationToken ct = default)
    {
        lock (_writerLock)
        {
            _writer?.Dispose();
            _writer = new IndexWriter(_dir, new IndexWriterConfig(AppLuceneVersion, _analyzer)
            {
                OpenMode = OpenMode.CREATE 
            });
        }

        var metas = await _files.GetAllBlogPostsMetaAsync(); 
        foreach (var meta in metas)
        {
            if (meta.IsDraft) continue; 
            if (string.IsNullOrWhiteSpace(meta.PostFolderPath)) continue;

            var content = await _files.GetBlogPostContentAsync(meta.PostFolderPath);
            if (content is null) continue;

            await IndexOrUpdateAsync(meta, content, ct);
        }

        lock (_writerLock) { _writer?.Commit(); }
    }

    public Task IndexOrUpdateAsync(BlogPostMetaResponse meta, string content, CancellationToken ct = default)
    {
        var doc = new Document
        {
            new StringField("slug", meta.Slug ?? string.Empty, Field.Store.YES),
            new StringField("id", meta.Id.ToString(), Field.Store.YES),
            new StringField("author", meta.AuthorUsername ?? string.Empty, Field.Store.YES),

            new TextField("title", meta.Title ?? string.Empty, Field.Store.YES),
            new TextField("description", meta.Description ?? string.Empty, Field.Store.YES),
            new TextField("content", content ?? string.Empty, Field.Store.NO) 
        };

        if (meta.Tags != null)
            foreach (var t in meta.Tags) doc.Add(new StringField("tag", t.ToString(), Field.Store.NO));
        if (meta.Categories != null)
            foreach (var c in meta.Categories) doc.Add(new StringField("category", c.ToString(), Field.Store.NO));

        lock (_writerLock)
        {
            _writer!.UpdateDocument(new Term("slug", meta.Slug ?? string.Empty), doc);
        }
        return Task.CompletedTask;
    }

    public Task DeleteBySlugAsync(string slug, CancellationToken ct = default)
    {
        lock (_writerLock)
        {
            _writer!.DeleteDocuments(new Term("slug", slug));
            _writer.Commit();
        }
        return Task.CompletedTask;
    }
public Task<IReadOnlyList<string>> SearchSlugsAsync(string query, int limit = 50, CancellationToken ct = default)
{
    if (string.IsNullOrWhiteSpace(query))
        return Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());

    var qtxt = QueryParserBase.Escape(query.Trim()); 
    qtxt = System.Text.RegularExpressions.Regex.Replace(qtxt, @"\s+", " ");

    using var reader = DirectoryReader.Open(_dir);
    var searcher = new IndexSearcher(reader);

    var fields = new[] { "title", "description", "content", "author" };
    var boosts = new Dictionary<string, float> { ["title"] = 3f, ["description"] = 1.5f, ["content"] = 1f, ["author"] = 1f };
    var parser = new MultiFieldQueryParser(AppLuceneVersion, fields, _analyzer, boosts)
    {
        DefaultOperator = Operator.AND 
    };

    Query q;
    try
    {
        q = parser.Parse(qtxt);
    }
    catch (ParseException)
    {
        var bq = new BooleanQuery();
        foreach (var f in fields)
            bq.Add(new TermQuery(new Term(f, qtxt)), Occur.SHOULD);
        q = bq;
    }

    var hits = searcher.Search(q, limit);
    var slugs = new List<string>(Math.Min(limit, hits.ScoreDocs.Length));
    foreach (var sd in hits.ScoreDocs)
    {
        var doc = searcher.Doc(sd.Doc);
        slugs.Add(doc.Get("slug"));
    }
    return Task.FromResult<IReadOnlyList<string>>(slugs);
}

    public void Dispose()
    {
        lock (_writerLock)
        {
            _writer?.Dispose();
            _dir.Dispose();
            _analyzer.Dispose();
        }
    }
}
