/**
 * Funding Rates Card Component
 * Displays futures sentiment and detailed funding rates from multiple exchanges
 */

import { Clock, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCombinedSentiment } from "@/hooks/use-combined-sentiment";
import { useAllFundingRates } from "@/hooks/use-funding-rates";

type FundingRatesCardProps = {
  symbol: string;
};

const PERCENTAGE_MULTIPLIER = 100;
const FUNDING_RATE_TO_PERCENT = 100;

export function FundingRatesCard({ symbol }: FundingRatesCardProps) {
  const { data: sentiment, isLoading: sentimentLoading } =
    useCombinedSentiment(symbol);
  const { data: fundingRates, isLoading: ratesLoading } =
    useAllFundingRates(symbol);

  const isLoading = sentimentLoading || ratesLoading;

  if (isLoading) {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            Funding Rates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full animate-pulse" />
          <Skeleton className="h-20 w-full animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!sentiment) {
    return (
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            Funding Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Unable to load funding data
          </p>
        </CardContent>
      </Card>
    );
  }

  const futuresData = sentiment.components.futures;
  const signal = futuresData.signal;

  const getSentimentColor = (sig: string) => {
    if (sig === "BULLISH") return "text-green-500";
    if (sig === "BEARISH") return "text-red-500";
    return "text-gray-500";
  };

  const getSentimentIcon = (sig: string) => {
    if (sig === "BULLISH") return <TrendingUp className="h-4 w-4" />;
    if (sig === "BEARISH") return <TrendingDown className="h-4 w-4" />;
    return null;
  };

  const getSentimentBgColor = (sig: string) => {
    if (sig === "BULLISH") return "bg-green-500/10 border-green-500/20";
    if (sig === "BEARISH") return "bg-red-500/10 border-red-500/20";
    return "bg-gray-500/10 border-gray-500/20";
  };

  const formatFundingRate = (rate: number) => {
    const percentage = rate * FUNDING_RATE_TO_PERCENT;
    return percentage >= 0
      ? `+${percentage.toFixed(4)}%`
      : `${percentage.toFixed(4)}%`;
  };

  const getFundingRateColor = (rate: number) => {
    if (rate > 0.01) return "text-green-500";
    if (rate < -0.01) return "text-red-500";
    return "text-gray-500";
  };

  const getTimeUntilNext = (nextTime: Date) => {
    const now = new Date();
    const diff = new Date(nextTime).getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Normalize score from -100..100 to 0..100 for progress bar
  const progressValue = (futuresData.score + 100) / 2;

  const exchanges = fundingRates ? Object.entries(fundingRates) : [];

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              Ставки Финансирования
            </CardTitle>
            <p className="mt-1 text-muted-foreground text-xs">
              Настроения на фьючерсном рынке по биржам
            </p>
          </div>
          <Badge className={getSentimentBgColor(signal)} variant="outline">
            <div className="flex items-center gap-1">
              {getSentimentIcon(signal)}
              <span>{signal}</span>
            </div>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Futures Sentiment */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Фьючерсный Сентимент</span>
            <span className={`font-bold text-2xl ${getSentimentColor(signal)}`}>
              {futuresData.score.toFixed(2)}
            </span>
          </div>
          <Progress className="h-2" value={progressValue} />
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Медвежий (-100)</span>
            <span>Нейтральный (0)</span>
            <span>Бычий (+100)</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card p-2">
            <p className="text-muted-foreground text-xs">Уверенность</p>
            <p className="mt-1 font-bold text-sm">
              {Math.round(futuresData.confidence * PERCENTAGE_MULTIPLIER)}%
            </p>
          </div>
          <div className="rounded-lg border bg-card p-2">
            <p className="text-muted-foreground text-xs">Вес</p>
            <p className="mt-1 font-bold text-sm">
              {Math.round(futuresData.weight * PERCENTAGE_MULTIPLIER)}%
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Exchange Funding Rates */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Ставки по биржам</h4>
          {exchanges.length === 0 ? (
            <p className="text-center text-muted-foreground text-xs">
              No exchange data available
            </p>
          ) : (
            exchanges.map(([exchange, data]) => (
              <div
                className="rounded-lg border bg-card p-2 transition-colors hover:bg-accent/50"
                key={exchange}
              >
                {/* Exchange Header */}
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs capitalize">
                      {exchange}
                    </span>
                    <Badge className="text-[10px]" variant="secondary">
                      {data.sentiment}
                    </Badge>
                  </div>
                  <span
                    className={`font-bold text-sm ${getFundingRateColor(data.fundingRate)}`}
                  >
                    {formatFundingRate(data.fundingRate)}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <div>
                    <p className="text-muted-foreground">24h Avg</p>
                    <p className="font-medium">
                      {formatFundingRate(data.avgFunding24h)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">7d Avg</p>
                    <p className="font-medium">
                      {formatFundingRate(data.avgFunding7d)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next</p>
                    <p className="font-medium">
                      {getTimeUntilNext(data.nextFundingTime)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Info */}
        <div className="rounded-lg border bg-muted/50 p-2">
          <p className="text-muted-foreground text-xs leading-relaxed">
            <strong>Положительная ставка</strong> = лонги платят шортам (бычий
            настрой).
            <br />
            <strong>Отрицательная ставка</strong> = шорты платят лонгам
            (медвежий настрой).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
