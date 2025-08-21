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
using Lucene.Net.Analysis.TokenAttributes;
using Lucene.Net.Search.Spans;
using Lucene.Net.Queries.Function;


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
            new TextField("author", meta.AuthorUsername ?? string.Empty, Field.Store.YES),

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

    var tokens = AnalyzeTerms(_analyzer, "content", query);
    if (tokens.Count == 0)
        return Task.FromResult<IReadOnlyList<string>>(Array.Empty<string>());

    using var reader = DirectoryReader.Open(_dir);
    var searcher = new IndexSearcher(reader);

    var fieldsWithBoosts = new (string field, float boost)[] {
        ("title", 3f),
        ("description", 3f),
        ("content", 3f),
        ("author", 3f)
    };

    var mustAllTerms = new BooleanQuery();

    foreach (var t in tokens)
    {
        var anyField = new BooleanQuery { MinimumNumberShouldMatch = 1 };

        foreach (var (field, boost) in fieldsWithBoosts)
        {
            var tq = new TermQuery(new Term(field, t));
            if (boost != 1f) tq.Boost = boost;
            anyField.Add(tq, Occur.SHOULD);
        }

        mustAllTerms.MinimumNumberShouldMatch = 1;
    }

    if (tokens.Count >= 2)
    {
        var titlePhrase = new PhraseQuery { Slop = 1 };
        foreach (var tok in tokens) titlePhrase.Add(new Term("title", tok));
        titlePhrase.Boost = 4f; 
        mustAllTerms.Add(titlePhrase, Occur.SHOULD);

        var contentPhrase = new PhraseQuery { Slop = 3 };
        foreach (var tok in tokens) contentPhrase.Add(new Term("content", tok));
        contentPhrase.Boost = 1.5f;
        mustAllTerms.Add(contentPhrase, Occur.SHOULD);
    }

    foreach (var t in tokens.Where(x => x.Length >= 3))
    {
        var anyFieldPrefix = new BooleanQuery { MinimumNumberShouldMatch = 1 };
        foreach (var (field, boost) in fieldsWithBoosts)
        {
            var pq = new PrefixQuery(new Term(field, t));
            pq.Boost = 0.4f * boost;
            anyFieldPrefix.Add(pq, Occur.SHOULD);
        }
        mustAllTerms.Add(anyFieldPrefix, Occur.SHOULD);
    }

    var hits = searcher.Search(mustAllTerms, limit);
    var slugs = new List<string>(Math.Min(limit, hits.ScoreDocs.Length));
    foreach (var sd in hits.ScoreDocs)
    {
        var doc = searcher.Doc(sd.Doc);
        slugs.Add(doc.Get("slug"));
    }
    return Task.FromResult<IReadOnlyList<string>>(slugs);
}

private static List<string> AnalyzeTerms(Analyzer analyzer, string field, string text)
{
    var results = new List<string>();
    using var reader = new System.IO.StringReader(text);
    using var ts = analyzer.GetTokenStream(field, reader);
    var termAttr = ts.AddAttribute<ICharTermAttribute>();
    ts.Reset();
    while (ts.IncrementToken()) results.Add(termAttr.ToString());
    ts.End();
    return results;
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
