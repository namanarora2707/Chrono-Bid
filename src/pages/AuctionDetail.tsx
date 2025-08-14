import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Gavel, Clock, DollarSign, User, TrendingUp } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Auction {
  id: string;
  title: string;
  description: string;
  starting_price: number;
  current_highest_bid: number | null;
  highest_bidder_id: string | null;
  bid_increment: number;
  start_time: string;
  end_time: string;
  status: string;
  image_url: string | null;
  seller_id: string;
  profiles?: {
    full_name: string;
  } | null;
}

interface Bid {
  id: string;
  amount: number;
  created_at: string;
  profiles?: {
    full_name: string;
  } | null;
}

const AuctionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState("");
  const [submittingBid, setSubmittingBid] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    fetchAuctionData();
    
    // Subscribe to real-time updates for auctions
    const auctionChannel = supabase
      .channel(`auction-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${id}`
        },
        () => {
          fetchAuctionData();
        }
      )
      .subscribe();

    // Subscribe to real-time updates for bids
    const bidsChannel = supabase
      .channel(`bids-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bids',
          filter: `auction_id=eq.${id}`
        },
        () => {
          fetchBids();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(auctionChannel);
      supabase.removeChannel(bidsChannel);
    };
  }, [id]);

  const fetchAuctionData = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('auctions')
        .select(`
          *,
          profiles:seller_id(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setAuction(data as any);
      
      // Set suggested bid amount
      const minBid = data.current_highest_bid 
        ? data.current_highest_bid + data.bid_increment 
        : data.starting_price;
      setBidAmount(minBid.toFixed(2));
      
      await fetchBids();
    } catch (error) {
      console.error('Error fetching auction:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load auction details",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          profiles:bidder_id(full_name)
        `)
        .eq('auction_id', id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setBids((data as any) || []);
    } catch (error) {
      console.error('Error fetching bids:', error);
    }
  };

  const placeBid = async () => {
    if (!user || !auction || !bidAmount) return;

    const amount = parseFloat(bidAmount);
    const minBid = auction.current_highest_bid 
      ? auction.current_highest_bid + auction.bid_increment 
      : auction.starting_price;

    if (amount < minBid) {
      toast({
        variant: "destructive",
        title: "Invalid bid",
        description: `Minimum bid is $${minBid.toFixed(2)}`,
      });
      return;
    }

    if (auction.seller_id === user.id) {
      toast({
        variant: "destructive",
        title: "Invalid bid",
        description: "You cannot bid on your own auction",
      });
      return;
    }

    if (auction.status !== 'active') {
      toast({
        variant: "destructive",
        title: "Auction not active",
        description: "This auction is not currently accepting bids",
      });
      return;
    }

    setSubmittingBid(true);

    try {
      // Place the bid
      const { error: bidError } = await supabase
        .from('bids')
        .insert([
          {
            auction_id: auction.id,
            bidder_id: user.id,
            amount,
          },
        ]);

      if (bidError) throw bidError;

      // Update auction with new highest bid
      const { error: updateError } = await supabase
        .from('auctions')
        .update({
          current_highest_bid: amount,
          highest_bidder_id: user.id,
        })
        .eq('id', auction.id);

      if (updateError) throw updateError;

      toast({
        title: "Bid placed!",
        description: `Your bid of $${amount.toFixed(2)} has been placed successfully.`,
      });

      // Update suggested next bid amount
      setBidAmount((amount + auction.bid_increment).toFixed(2));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setSubmittingBid(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success';
      case 'pending': return 'bg-warning';
      case 'ended': return 'bg-muted';
      default: return 'bg-muted';
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
          <p>Loading auction details...</p>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Auction not found</h2>
          <Button onClick={() => navigate("/")}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const isAuctionEnded = new Date(auction.end_time) < new Date();
  const isOwnAuction = user?.id === auction.seller_id;
  const minBid = auction.current_highest_bid 
    ? auction.current_highest_bid + auction.bid_increment 
    : auction.starting_price;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div className="flex items-center space-x-3">
            <div className="auction-gradient p-2 rounded-lg">
              <Gavel className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Auction Details</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Auction Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <Badge className={`${getStatusColor(auction.status)} text-white`}>
                    {auction.status}
                  </Badge>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>by {auction.profiles?.full_name || "Unknown"}</span>
                  </div>
                </div>
                <CardTitle className="text-3xl">{auction.title}</CardTitle>
                {auction.description && (
                  <CardDescription className="text-base">
                    {auction.description}
                  </CardDescription>
                )}
              </CardHeader>
              
              {auction.image_url && (
                <CardContent className="pt-0">
                  <img
                    src={auction.image_url}
                    alt={auction.title}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </CardContent>
              )}
            </Card>

            {/* Bid History */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Bid History</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bids.length === 0 ? (
                  <p className="text-muted-foreground">No bids yet. Be the first to bid!</p>
                ) : (
                  <div className="space-y-3">
                    {bids.map((bid, index) => (
                      <div
                        key={bid.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                            index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground text-background'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{bid.profiles?.full_name || "Anonymous"}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(bid.created_at), "MMM d, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${index === 0 ? 'text-primary' : ''}`}>
                            ${bid.amount.toFixed(2)}
                          </p>
                          {index === 0 && (
                            <p className="text-xs text-primary">Highest Bid</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bidding Panel */}
          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Current Price</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    ${auction.current_highest_bid?.toFixed(2) || auction.starting_price.toFixed(2)}
                  </p>
                  {auction.current_highest_bid && (
                    <p className="text-sm text-muted-foreground">
                      Starting price: ${auction.starting_price.toFixed(2)}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex items-center space-x-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={isAuctionEnded ? "text-red-600" : "text-muted-foreground"}>
                    {getTimeRemaining(auction.end_time)}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>Bid increment: ${auction.bid_increment.toFixed(2)}</p>
                  <p>Minimum bid: ${minBid.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Place Bid */}
            {!isAuctionEnded && !isOwnAuction && auction.status === 'active' && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Place a Bid</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bidAmount">Your Bid ($)</Label>
                    <Input
                      id="bidAmount"
                      type="number"
                      step="0.01"
                      min={minBid}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={minBid.toFixed(2)}
                    />
                  </div>
                  <Button
                    onClick={placeBid}
                    disabled={submittingBid || !bidAmount}
                    className="w-full auction-gradient text-white shadow-elegant"
                  >
                    {submittingBid ? "Placing Bid..." : "Place Bid"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Auction Info */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Auction Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started:</span>
                  <span>{format(new Date(auction.start_time), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ends:</span>
                  <span>{format(new Date(auction.end_time), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Bids:</span>
                  <span>{bids.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuctionDetail;