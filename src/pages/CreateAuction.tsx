import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Gavel } from "lucide-react";

const CreateAuction = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    starting_price: "",
    bid_increment: "1.00",
    start_time: "",
    end_time: "",
    image_url: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const startTime = new Date(formData.start_time);
      const endTime = new Date(formData.end_time);
      const now = new Date();

      // Validation
      if (startTime < now) {
        throw new Error("Start time must be in the future");
      }
      if (endTime <= startTime) {
        throw new Error("End time must be after start time");
      }

      const { data, error } = await supabase
        .from('auctions')
        .insert([
          {
            seller_id: user.id,
            title: formData.title,
            description: formData.description,
            starting_price: parseFloat(formData.starting_price),
            bid_increment: parseFloat(formData.bid_increment),
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            image_url: formData.image_url || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your auction has been created successfully.",
      });

      navigate(`/auction/${data.id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-2xl">
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
            <h1 className="text-2xl font-bold">Create New Auction</h1>
          </div>
        </div>

        {/* Form */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Auction Details</CardTitle>
            <CardDescription>
              Fill in the details for your auction. Make sure to provide accurate information.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Item Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="e.g., Vintage Watch Collection"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Describe your item in detail..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Image URL (optional)</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => handleInputChange("image_url", e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starting_price">Starting Price ($) *</Label>
                  <Input
                    id="starting_price"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.starting_price}
                    onChange={(e) => handleInputChange("starting_price", e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bid_increment">Bid Increment ($) *</Label>
                  <Input
                    id="bid_increment"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.bid_increment}
                    onChange={(e) => handleInputChange("bid_increment", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Date & Time *</Label>
                  <Input
                    id="start_time"
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange("start_time", e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_time">End Date & Time *</Label>
                  <Input
                    id="end_time"
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange("end_time", e.target.value)}
                    min={formData.start_time || new Date().toISOString().slice(0, 16)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="auction-gradient text-white shadow-elegant"
                >
                  {loading ? "Creating..." : "Create Auction"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateAuction;