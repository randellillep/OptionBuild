import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Info, Copy, Check } from "lucide-react";
import type { OptionLeg } from "@shared/schema";

interface SaveTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbolInfo: { symbol: string; price: number };
  legs: OptionLeg[];
  selectedExpirationDate: string | null;
  isAuthenticated?: boolean;
}

export function SaveTradeModal({ isOpen, onClose, symbolInfo, legs, selectedExpirationDate, isAuthenticated = false }: SaveTradeModalProps) {
  const [tradeName, setTradeName] = useState("");
  const [description, setDescription] = useState("");
  const [group, setGroup] = useState("all");
  const [isSaving, setIsSaving] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateDefaultName = () => {
    if (legs.length === 0) return `${symbolInfo.symbol} Trade`;
    
    const leg = legs[0];
    const expDate = selectedExpirationDate 
      ? new Date(selectedExpirationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
      : '';
    const strikeStr = leg.strike.toString();
    const typeStr = leg.type === 'call' ? 'Call' : 'Put';
    const positionStr = leg.position === 'long' ? 'Long' : 'Short';
    
    return `${symbolInfo.symbol} ${expDate} ${strikeStr} ${positionStr} ${typeStr}`;
  };

  const generateShareLink = () => {
    const tradeData = {
      n: tradeName || generateDefaultName(),
      d: description,
      s: symbolInfo.symbol,
      p: symbolInfo.price,
      e: selectedExpirationDate,
      l: legs.map(leg => ({
        t: leg.type,
        pos: leg.position,
        st: leg.strike,
        q: leg.quantity,
        pr: leg.premium,
        expD: leg.expirationDays,
        expDt: leg.expirationDate,
      })),
    };
    
    const encoded = btoa(JSON.stringify(tradeData));
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/${encoded}`;
  };

  const handleSaveForGuest = () => {
    setIsSaving(true);
    
    try {
      const link = generateShareLink();
      setShareLink(link);
      
      toast({
        title: "Share link created",
        description: "Copy the link to share this strategy with others.",
      });
    } catch (error) {
      toast({
        title: "Error creating share link",
        description: "There was a problem creating your share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareLink) {
      try {
        await navigator.clipboard.writeText(shareLink);
        setCopied(true);
        toast({
          title: "Link copied",
          description: "Share link has been copied to your clipboard.",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({
          title: "Failed to copy",
          description: "Please copy the link manually.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    
    try {
      const tradeData = {
        name: tradeName || generateDefaultName(),
        description,
        group,
        symbol: symbolInfo.symbol,
        price: symbolInfo.price,
        legs,
        expirationDate: selectedExpirationDate,
        savedAt: new Date().toISOString(),
      };

      let savedTrades: unknown[] = [];
      try {
        const stored = localStorage.getItem('savedTrades');
        if (stored) {
          savedTrades = JSON.parse(stored);
          if (!Array.isArray(savedTrades)) {
            savedTrades = [];
          }
        }
      } catch {
        savedTrades = [];
      }

      savedTrades.push({ id: Date.now().toString(), ...tradeData });
      localStorage.setItem('savedTrades', JSON.stringify(savedTrades));

      toast({
        title: "Trade saved",
        description: `"${tradeData.name}" has been saved to your trades.`,
      });

      setTradeName("");
      setDescription("");
      setGroup("all");
      onClose();
    } catch (error) {
      toast({
        title: "Error saving trade",
        description: "There was a problem saving your trade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setShareLink(null);
      setCopied(false);
      onClose();
    }
  };

  if (!isAuthenticated) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="modal-share-trade">
          <DialogHeader>
            <DialogTitle>Share this Trade</DialogTitle>
          </DialogHeader>

          <Alert className="border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm">
              Consider <a href="/api/login" className="text-primary font-medium hover:underline">creating a free account</a> to view and track your saved trades, making it easy to "paper trade" options by saving trades and watching how they perform over time.
            </AlertDescription>
          </Alert>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="trade-name" className="text-sm">
                Trade Name: <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="trade-name"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder={generateDefaultName()}
                data-testid="input-trade-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trade-description" className="text-sm">
                Trade Description: <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="trade-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter your reasoning, notes, or due diligence here"
                className="min-h-[100px] resize-y"
                data-testid="input-trade-description"
              />
            </div>

            {shareLink ? (
              <div className="space-y-2">
                <Label className="text-sm">Share Link:</Label>
                <div className="flex gap-2">
                  <Input 
                    value={shareLink} 
                    readOnly 
                    className="font-mono text-xs"
                    data-testid="input-share-link"
                  />
                  <Button 
                    size="icon" 
                    variant="outline" 
                    onClick={handleCopyLink}
                    data-testid="button-copy-link"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleSaveForGuest}
                disabled={isSaving}
                data-testid="button-save-trade-confirm"
              >
                {isSaving ? "Creating link..." : "Save trade"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-save-trade">
        <DialogHeader>
          <DialogTitle>Save & Share this Trade</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="trade-name" className="text-sm">
              Trade Name: <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="trade-name"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              placeholder={generateDefaultName()}
              data-testid="input-trade-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trade-description" className="text-sm">
              Trade Description: <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="trade-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter your reasoning, notes, or due diligence here"
              className="min-h-[100px] resize-y"
              data-testid="input-trade-description"
            />
          </div>

          <div className="flex items-center gap-3">
            <Label htmlFor="trade-group" className="text-sm shrink-0">
              Group:
            </Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger className="w-[120px]" data-testid="select-trade-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-group-all">All</SelectItem>
                <SelectItem value="favorites" data-testid="option-group-favorites">Favorites</SelectItem>
                <SelectItem value="watchlist" data-testid="option-group-watchlist">Watchlist</SelectItem>
                <SelectItem value="earnings" data-testid="option-group-earnings">Earnings</SelectItem>
                <SelectItem value="research" data-testid="option-group-research">Research</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            data-testid="button-save-trade-confirm"
          >
            {isSaving ? "Saving..." : "Save trade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
