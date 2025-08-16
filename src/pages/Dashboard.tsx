import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Clock, DollarSign, Gavel, Plus, Search, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Auction {
  id: string;
  title: string;
  description: string;
  starting_price: number;
  current_highest_bid: number | null;
  start_time: string;
  end_time: string;
  status: string;
  image_url: string | null;
  seller_id: string;
  profiles?: {
    full_name: string;
  } | null;
  deleted?: boolean;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "ended">(
    "all"
  );

  useEffect(() => {
    fetchAuctions();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("auctions-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auctions",
        },
        () => {
          fetchAuctions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAuctions = async () => {
    try {
      const { data, error } = await supabase
        .from("auctions")
        .select(
          `
          *,
          profiles:seller_id(full_name)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAuctions(
        (data as any)?.filter(
          (auction: Auction) =>
            !auction.deleted || auction.seller_id === user?.id
        ) || []
      );
    } catch (error) {
      console.error("Error fetching auctions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAuctions = auctions.filter((auction) => {
    const now = new Date();
    const start = new Date(auction.start_time);
    const end = new Date(auction.end_time);

    // Force status to 'ended' if end_time has passed
    let status = auction.status;
    if (end < now) status = "ended";
    else if (start <= now && end > now && auction.status !== "ended")
      status = "active";
    else if (start > now && auction.status !== "ended") status = "pending";

    const matchesSearch =
      auction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      auction.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "all" || status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success";
      case "pending":
        return "bg-warning";
      case "ended":
        return "bg-muted";
      default:
        return "bg-muted";
    }
  };

  const getTimeRemaining = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    if (end < now) return "Ended";
    return `Ends ${formatDistanceToNow(end, { addSuffix: true })}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Gavel className="h-12 w-12 mx-auto mb-4 text-primary animate-bounce" />
          <p>Loading auctions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="auction-gradient p-2 rounded-lg">
              <Gavel className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Auction Platform</h1>
          </div>

          <div className="flex items-center space-x-4">
            <Link to="/create-auction">
              <Button className="auction-gradient text-white shadow-elegant">
                <Plus className="h-4 w-4 mr-2" />
                Create Auction
              </Button>
            </Link>
            <Button variant="outline" onClick={() => signOut()}>
              <User className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search auctions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex space-x-2">
            {["all", "active", "pending", "ended"].map((status) => (
              <Button
                key={status}
                variant={filter === status ? "default" : "outline"}
                onClick={() => setFilter(status as any)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {/* Auctions Grid */}
        {filteredAuctions.length === 0 ? (
          <div className="text-center py-12">
            <Gavel className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No auctions found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filter !== "all"
                ? "Try adjusting your search or filters"
                : "Be the first to create an auction!"}
            </p>
            <Link to="/create-auction">
              <Button className="auction-gradient text-white">
                <Plus className="h-4 w-4 mr-2" />
                Create First Auction
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map((auction) => (
              <Link key={auction.id} to={`/auction/${auction.id}`}>
                <Card className="card-gradient shadow-card hover:shadow-glow transition-smooth cursor-pointer h-full">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        className={`${getStatusColor(
                          auction.status
                        )} text-white`}
                      >
                        {auction.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        by {auction.profiles?.full_name || "Unknown"}
                      </span>
                    </div>
                    <CardTitle className="line-clamp-2">
                      {auction.title}
                    </CardTitle>
                    {auction.description && (
                      <CardDescription className="line-clamp-2">
                        {auction.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="font-semibold">
                          $
                          {auction.current_highest_bid ||
                            auction.starting_price}
                        </span>
                      </div>
                      {auction.current_highest_bid && (
                        <span className="text-sm text-muted-foreground">
                          Starting: ${auction.starting_price}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{getTimeRemaining(auction.end_time)}</span>
                    </div>

                    <div className="flex gap-3">
                      {user?.id === auction.seller_id && (
                        <Button
                          className="w-full bg-destructive text-white mt-2"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (
                              window.confirm(
                                "Are you sure you want to remove this bid? It will be marked as ended."
                              )
                            ) {
                              const { error } = await supabase
                                .from("auctions")
                                .update({
                                  status: "ended",
                                  end_time: new Date().toISOString(),
                                })
                                .eq("id", auction.id);
                              if (!error) {
                                setAuctions((prev) =>
                                  prev.map((a) =>
                                    a.id === auction.id
                                      ? {
                                          ...a,
                                          status: "ended",
                                          end_time: new Date().toISOString(),
                                        }
                                      : a
                                  )
                                );
                              }
                            }
                          }}
                        >
                          Remove Bid
                        </Button>
                      )}
                      {/* // ...inside CardContent, after Remove Bid button... */}

                      {user?.id === auction.seller_id && (
                        <Button
                          className="w-full bg-blue-500 text-white mt-2"
                          onClick={async (e) => {
                            e.preventDefault();
                            if (
                              window.confirm(
                                "Are you sure you want to permanently delete this bid? This action cannot be undone."
                              )
                            ) {
                              const { error } = await supabase
                                .from("auctions")
                                .delete()
                                .eq("id", auction.id);
                              if (!error) {
                                setAuctions((prev) =>
                                  prev.filter((a) => a.id !== auction.id)
                                );
                              }
                            }
                          }}
                        >
                          Delete Bid
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
