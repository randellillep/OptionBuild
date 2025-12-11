import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatAssistantProps {
  onNavigate?: (page: string) => void;
}

const navigationCommands: Record<string, { page: string; response: string }> = {
  "go to backtest": { page: "/backtest", response: "Taking you to the Backtest page where you can analyze historical performance." },
  "show backtest": { page: "/backtest", response: "Opening the Backtest page for historical analysis." },
  "backtest": { page: "/backtest", response: "Navigating to the Backtest page." },
  "go to option finder": { page: "/option-finder", response: "Opening Option Finder to help you discover strategies." },
  "option finder": { page: "/option-finder", response: "Taking you to Option Finder." },
  "find options": { page: "/option-finder", response: "Opening Option Finder to explore strategy opportunities." },
  "go to skew": { page: "/skew", response: "Opening the Volatility Skew analysis page." },
  "volatility skew": { page: "/skew", response: "Navigating to Volatility Skew analysis." },
  "skew": { page: "/skew", response: "Taking you to the Skew page." },
  "go to financials": { page: "/financials", response: "Opening Financials for company fundamentals." },
  "financials": { page: "/financials", response: "Navigating to the Financials page." },
  "fundamentals": { page: "/financials", response: "Taking you to company Financials." },
  "go home": { page: "/", response: "Taking you back to the Home page." },
  "home": { page: "/", response: "Navigating to Home." },
  "go to builder": { page: "/builder", response: "Opening the Strategy Builder." },
  "builder": { page: "/builder", response: "Navigating to the Builder page." },
};

const helpResponses: Record<string, string> = {
  "what is a call": "A call option gives you the right to BUY a stock at a specific price (strike) before expiration. You profit when the stock goes UP above your strike price.",
  "what is a put": "A put option gives you the right to SELL a stock at a specific price (strike) before expiration. You profit when the stock goes DOWN below your strike price.",
  "what is delta": "Delta measures how much an option's price changes for every $1 move in the stock. A delta of 0.50 means the option gains $0.50 for each $1 the stock rises.",
  "what is theta": "Theta represents time decay - how much value your option loses each day. Options lose value as expiration approaches, especially in the last 30 days.",
  "what is iv": "Implied Volatility (IV) reflects the market's expectation of future price movement. Higher IV = more expensive options. IV often spikes before earnings.",
  "what is gamma": "Gamma measures how fast delta changes. High gamma means your position becomes more sensitive to price moves. It's highest for at-the-money options near expiration.",
  "what is vega": "Vega shows how much an option's price changes with a 1% change in implied volatility. Higher vega means more sensitivity to volatility changes.",
  "what is a spread": "A spread involves buying and selling options together to limit risk and cost. Common types include vertical spreads, iron condors, and butterflies.",
  "how to use": "Use the search bar to find stocks, select strategies from templates, adjust strikes on the ladder, and view P/L scenarios on the heatmap. Need help with something specific?",
  "what can you do": "I can help you navigate the app, explain options concepts, and answer questions about strategies. Try asking about calls, puts, Greeks, or say 'go to backtest'!",
};

export function AIChatAssistant({ onNavigate }: AIChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your options assistant. Ask me about strategies, Greeks, or say 'go to backtest' to navigate.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const processMessage = (userInput: string): string => {
    const lower = userInput.toLowerCase().trim();

    for (const [command, data] of Object.entries(navigationCommands)) {
      if (lower.includes(command)) {
        if (onNavigate) {
          setTimeout(() => onNavigate(data.page), 500);
        }
        return data.response;
      }
    }

    for (const [keyword, response] of Object.entries(helpResponses)) {
      if (lower.includes(keyword)) {
        return response;
      }
    }

    if (lower.includes("help") || lower === "?") {
      return "I can help with:\n• Navigation: 'go to backtest', 'option finder', 'skew', 'financials'\n• Concepts: 'what is a call', 'what is delta', 'what is IV'\n• Usage: 'how to use' this platform\n\nWhat would you like to know?";
    }

    if (lower.includes("hello") || lower.includes("hi") || lower === "hey") {
      return "Hello! How can I help you with options today? Ask me about strategies, Greeks, or navigation.";
    }

    if (lower.includes("thank")) {
      return "You're welcome! Let me know if you need anything else.";
    }

    return "I'm not sure about that. Try asking about options concepts like 'what is delta' or navigate with 'go to backtest'. Type 'help' for more options.";
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = processMessage(userMessage.content);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <Card className="flex flex-col h-[380px] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-semibold">AI Assistant</span>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {message.role === "user" ? (
                  <User className="h-3.5 w-3.5" />
                ) : (
                  <Bot className="h-3.5 w-3.5" />
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-2">
              <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form 
        className="p-2 border-t border-border"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about options..."
            className="flex-1 h-8 text-sm"
            data-testid="input-ai-chat"
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!input.trim()}
            data-testid="button-send-message"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
