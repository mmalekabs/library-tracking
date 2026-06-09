import { useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
} from "recharts";
import {
  BookOpen,
  FileText,
  Wallet,
  PiggyBank,
  BarChart3,
  Users,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  TrendingUp,
} from "lucide-react";
import {
  fetchStatsOverview,
  fetchStatsReading,
  fetchStatsSpending,
  fetchStatsAuthors,
  fetchStatsPublishers,
  fetchStatsFormats,
  fetchStatsTimeline,
  fetchStatsBookshelves,
  fetchStatsPages,
  fetchStatsLists,
} from "@/lib/stats";
import { StatCard, Section, ChartBox } from "@/components/admin/stats/StatCard";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  FORMAT_COLORS,
  FORMAT_LABELS,
  CHART_COLORS,
} from "@/constants/stats";

const chartH = 280;

export function DashboardPage() {
  const results = useQueries({
    queries: [
      { queryKey: ["stats", "overview"], queryFn: fetchStatsOverview },
      { queryKey: ["stats", "reading"], queryFn: fetchStatsReading },
      { queryKey: ["stats", "spending"], queryFn: fetchStatsSpending },
      { queryKey: ["stats", "authors"], queryFn: fetchStatsAuthors },
      { queryKey: ["stats", "publishers"], queryFn: fetchStatsPublishers },
      { queryKey: ["stats", "formats"], queryFn: fetchStatsFormats },
      { queryKey: ["stats", "timeline"], queryFn: fetchStatsTimeline },
      { queryKey: ["stats", "bookshelves"], queryFn: fetchStatsBookshelves },
      { queryKey: ["stats", "pages"], queryFn: fetchStatsPages },
      { queryKey: ["stats", "lists"], queryFn: fetchStatsLists },
    ],
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);

  const overview = results[0].data;
  const reading = results[1].data;
  const spending = results[2].data;
  const authors = results[3].data;
  const publishers = results[4].data;
  const formats = results[5].data;
  const timeline = results[6].data;
  const bookshelves = results[7].data;
  const pages = results[8].data;
  const lists = results[9].data;

  if (isLoading) {
    return <p className="text-gray-500">Loading statistics…</p>;
  }

  if (isError || !overview) {
    return (
      <p className="text-red-600">
        Could not load statistics. Make sure the API server is running.
      </p>
    );
  }

  const statusChartData =
    reading?.breakdown.map((s) => ({
      name: STATUS_LABELS[s.status] ?? s.status,
      value: s.count,
      fill: STATUS_COLORS[s.status] ?? "#6B7280",
    })) ?? [];

  const formatChartData =
    formats?.distribution.map((f) => ({
      name: FORMAT_LABELS[f.format] ?? f.format,
      value: f.count,
      fill: FORMAT_COLORS[f.format] ?? "#6B7280",
    })) ?? [];

  return (
    <div className="space-y-10 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          Library statistics and analytics
        </p>
      </div>

      {/* Section 1: KPIs */}
      <Section title="Overview">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="Total books"
            value={overview.totalBooks}
            sub={`+${overview.booksAddedThisMonth} this month`}
            icon={BookOpen}
          />
          <StatCard
            label="Total pages"
            value={overview.totalPages.toLocaleString()}
            sub={
              overview.avgPagesPerBook
                ? `avg ${overview.avgPagesPerBook} pages/book`
                : undefined
            }
            icon={FileText}
          />
          <StatCard
            label="Total spent"
            value={`${overview.totalSpent.toLocaleString()} SAR`}
            sub={
              overview.avgSpentPerBook
                ? `avg ${overview.avgSpentPerBook} SAR/book`
                : undefined
            }
            icon={Wallet}
          />
          <StatCard
            label="Total value"
            value={`${overview.totalValue.toLocaleString()} SAR`}
            sub={
              overview.avgValuePerBook
                ? `avg ${overview.avgValuePerBook} SAR/book (${overview.booksWithMarketPrice} priced)`
                : "Sum of market prices"
            }
            icon={TrendingUp}
          />
          <StatCard
            label="Total savings"
            value={
              overview.totalSavings !== null
                ? `${overview.totalSavings.toLocaleString()} SAR`
                : "N/A"
            }
            sub="Where market price is set"
            icon={PiggyBank}
          />
          <StatCard
            label="Average price"
            value={
              overview.averagePrice !== null
                ? `${overview.averagePrice} SAR`
                : "—"
            }
            sub={
              overview.medianPrice !== null
                ? `median ${overview.medianPrice} SAR`
                : undefined
            }
            icon={BarChart3}
          />
          <StatCard label="Authors" value={overview.totalAuthors} icon={Users} />
          <StatCard
            label="Publishers"
            value={overview.totalPublishers}
            icon={Building2}
          />
          <StatCard label="Books read" value={overview.booksRead} icon={CheckCircle} />
          <StatCard label="Public books" value={overview.publicBooks} icon={Eye} />
          <StatCard label="Hidden books" value={overview.hiddenBooks} icon={EyeOff} />
        </div>
      </Section>

      {/* Reading + Format */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartBox title="Reading status">
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie
                data={statusChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                label={({ name, percent }) =>
                  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {statusChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 flex flex-wrap gap-3 text-xs">
            {reading?.breakdown.map((s) => (
              <li key={s.status} className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: STATUS_COLORS[s.status] }}
                />
                {STATUS_LABELS[s.status]}: {s.count}
              </li>
            ))}
          </ul>
        </ChartBox>

        <ChartBox title="Format distribution">
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie
                data={formatChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {formatChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* Spending */}
      {spending && (
        <Section title="Spending analytics">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBox title="Spending per month">
              <ResponsiveContainer width="100%" height={chartH}>
                <BarChart data={spending.spendingByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#2c5f2d" name="SAR" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox title="Cumulative spending">
              <ResponsiveContainer width="100%" height={chartH}>
                <LineChart data={spending.cumulativeSpending}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#2c5f2d"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBox title="Average price by format">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={spending.avgPriceByFormat} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="format"
                    tick={{ fontSize: 11 }}
                    width={70}
                  />
                  <Tooltip />
                  <Bar dataKey="average" fill="#3B82F6" name="Avg SAR" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Most expensive"
                value={
                  spending.mostExpensive
                    ? `${spending.mostExpensive.purchasePrice} SAR`
                    : "—"
                }
                sub={spending.mostExpensive?.title}
              />
              <StatCard
                label="Cheapest"
                value={
                  spending.cheapest
                    ? `${spending.cheapest.purchasePrice} SAR`
                    : "—"
                }
                sub={spending.cheapest?.title}
              />
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBox title="Top 10 most expensive">
              <div className="max-h-64 overflow-auto text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2">Title</th>
                      <th className="py-2">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spending.topExpensive.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2" dir="auto">
                          <span className="line-clamp-1">{b.title}</span>
                          <span className="text-xs text-gray-500">{b.author}</span>
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          {b.purchasePrice} {b.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartBox>
            <ChartBox title="Top 10 cheapest">
              <div className="max-h-64 overflow-auto text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="py-2">Title</th>
                      <th className="py-2">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spending.topCheapest.map((b) => (
                      <tr key={b.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2" dir="auto">
                          <span className="line-clamp-1">{b.title}</span>
                        </td>
                        <td className="py-2">
                          {b.purchasePrice} {b.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartBox>
          </div>
        </Section>
      )}

      {/* Authors & Publishers */}
      {authors && (
        <Section title="Author analytics">
          <ChartBox title="Top 15 authors by book count">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={authors.topByBookCount}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar dataKey="bookCount" fill="#2c5f2d" name="Books" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <ChartBox title="All authors" className="mt-4">
            <div className="max-h-72 overflow-auto text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2">Name</th>
                    <th className="py-2">Books</th>
                    <th className="py-2">Pages</th>
                    <th className="py-2">Spent</th>
                    <th className="py-2">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {authors.table.slice(0, 30).map((a) => (
                    <tr key={a.id} className="border-b border-gray-50">
                      <td className="py-2" dir="auto">
                        {a.name}
                      </td>
                      <td className="py-2">{a.bookCount}</td>
                      <td className="py-2">{a.totalPages}</td>
                      <td className="py-2">{a.totalSpent}</td>
                      <td className="py-2">{a.avgPrice ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartBox>
        </Section>
      )}

      {publishers && publishers.topByBookCount.length > 0 && (
        <Section title="Publisher analytics">
          <ChartBox title="Top publishers by book count">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={publishers.topByBookCount.slice(0, 15)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="bookCount" fill="#8B5E3C" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>
      )}

      {/* Timeline */}
      {timeline && timeline.booksAddedPerMonth.length > 0 && (
        <Section title="Timeline & trends">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBox title="Books added per month">
              <ResponsiveContainer width="100%" height={chartH}>
                <AreaChart data={timeline.booksAddedPerMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#2c5f2d"
                    fill="#97bc62"
                    fillOpacity={0.4}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox title="Books added by format (stacked)">
              <ResponsiveContainer width="100%" height={chartH}>
                <AreaChart data={timeline.booksAddedByFormat}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    stackId="1"
                    dataKey="PHYSICAL"
                    fill={FORMAT_COLORS.PHYSICAL}
                    stroke={FORMAT_COLORS.PHYSICAL}
                  />
                  <Area
                    stackId="1"
                    dataKey="DIGITAL"
                    fill={FORMAT_COLORS.DIGITAL}
                    stroke={FORMAT_COLORS.DIGITAL}
                  />
                  <Area
                    stackId="1"
                    dataKey="AUDIO"
                    fill={FORMAT_COLORS.AUDIO}
                    stroke={FORMAT_COLORS.AUDIO}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          <ChartBox title="Books by publication decade">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={timeline.byPublicationDecade}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="decade" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#C4956A" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <div className="grid gap-4 sm:grid-cols-2">
            {timeline.oldestBook && (
              <StatCard
                label="Oldest in collection"
                value={timeline.oldestBook.year}
                sub={timeline.oldestBook.title}
              />
            )}
            {timeline.newestBook && (
              <StatCard
                label="Newest publication"
                value={timeline.newestBook.year}
                sub={timeline.newestBook.title}
              />
            )}
          </div>
        </Section>
      )}

      {/* Pages & Binding */}
      {pages && (
        <Section title="Pages & binding">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBox title="Page count distribution">
              <ResponsiveContainer width="100%" height={chartH}>
                <BarChart data={pages.histogram}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2c5f2d" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox title="Binding types">
              <ResponsiveContainer width="100%" height={chartH}>
                <PieChart>
                  <Pie
                    data={pages.bindingBreakdown.map((b) => ({
                      name: b.binding.replace(/_/g, " "),
                      value: b.count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {pages.bindingBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          {pages.scatter.length > 0 && (
            <ChartBox title="Pages vs purchase price">
              <ResponsiveContainer width="100%" height={chartH}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="pages" name="Pages" />
                  <YAxis type="number" dataKey="price" name="Price" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={pages.scatter} fill="#3B82F6" />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pages.longestBook && (
              <StatCard
                label="Longest book"
                value={`${pages.longestBook.pages} pp`}
                sub={pages.longestBook.title}
              />
            )}
            {pages.shortestBook && (
              <StatCard
                label="Shortest book"
                value={`${pages.shortestBook.pages} pp`}
                sub={pages.shortestBook.title}
              />
            )}
            <StatCard
              label="Average pages"
              value={pages.averagePages ?? "—"}
            />
            <StatCard label="Median pages" value={pages.medianPages ?? "—"} />
          </div>
        </Section>
      )}

      {/* Bookshelves */}
      {bookshelves && bookshelves.length > 0 && (
        <Section title="Bookshelves">
          <ChartBox title="Books per bookshelf">
            <ResponsiveContainer width="100%" height={Math.min(400, bookshelves.length * 28)}>
              <BarChart
                data={bookshelves.slice(0, 20)}
                layout="vertical"
                margin={{ left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar dataKey="bookCount" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <div className="mt-4 flex flex-wrap gap-2">
            {bookshelves.slice(0, 30).map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm"
                style={{
                  fontSize: `${Math.min(16, 10 + s.bookCount / 3)}px`,
                }}
                dir="auto"
              >
                {s.name} ({s.bookCount})
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Quick lists */}
      {lists && (
        <Section title="Quick lists">
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBox title="Recently added">
              <ul className="space-y-2 text-sm">
                {lists.recentlyAdded.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2 border-b border-gray-50 pb-2">
                    <Link
                      to={`/admin/books/${b.id}/edit`}
                      className="text-primary hover:underline"
                      dir="auto"
                    >
                      {b.title}
                    </Link>
                    <span className="shrink-0 text-gray-500">
                      {new Date(b.dateAdded).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            </ChartBox>
            <ChartBox title={`Currently reading (${lists.currentlyReading.length})`}>
              {lists.currentlyReading.length === 0 ? (
                <p className="text-sm text-gray-500">No books in progress.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {lists.currentlyReading.map((b) => (
                    <li key={b.id}>
                      <Link
                        to={`/admin/books/${b.id}/edit`}
                        className="text-primary hover:underline"
                        dir="auto"
                      >
                        {b.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ChartBox>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Without market price"
              value={lists.withoutMarketPrice.count}
            />
            <StatCard label="Without page count" value={lists.withoutPages.count} />
            <StatCard label="Without cover" value={lists.withoutCover.count} />
          </div>
          {lists.similarAuthors.length > 0 && (
            <ChartBox title="Possible duplicate authors">
              <ul className="text-sm text-amber-800">
                {lists.similarAuthors.map((p, i) => (
                  <li key={i}>
                    “{p.name1}” ↔ “{p.name2}”
                  </li>
                ))}
              </ul>
            </ChartBox>
          )}
        </Section>
      )}
    </div>
  );
}
