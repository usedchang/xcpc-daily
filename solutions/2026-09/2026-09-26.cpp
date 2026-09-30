#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
using i128=__int128_t;
struct Point{ ll x,y; };
ll cross(const Point &A,const Point &B){
    return A.x*B.y-A.y*B.x;
}//上界不会超过long long 
ll dist2(const Point &A,const Point &B){
    ll dx=A.x-B.x;
    ll dy=A.y-B.y;
    return dx*dx+dy*dy;
}//上界不会超过long long 
void solve(){
    int n;cin>>n;
    vector<Point>p(n*2);
    for(int i=0;i<n;i++) cin>>p[i].x>>p[i].y,p[i+n]=p[i];//输入处理
    vector<i128>pre(n*2);//可能会超出long long,上界在i128范围内
    for(int i=0;i+1<n*2;i++){
        pre[i+1]=pre[i]+cross(p[i],p[i+1]);
    }//因为保证输入是逆时针，所以可以直接对相邻点对做叉积和
    vector<vector<ll>>dp(n*2,vector<ll>(n*2));
    for(int r=0;r<n*2;r++){
        vector<ll>suf(r+1);
        for(int i=r-1;i>=0;i--) suf[i]=max(suf[i+1],dist2(p[i],p[r]));
        for(int l=0;l<r;l++) {
            if(r>0) dp[l][r]=dp[l][r-1];
            dp[l][r]=max(suf[l],dp[l][r]);
        }//求[l,r]内凸包最长直径
    }
    ll ans=LLONG_MAX;
    for(int l=0;l<n;l++){
        for(int r=l+1;r<n;r++){
            if(pre[r]-pre[l]+cross(p[r],p[l])==0) continue;
            if(pre[l+n]-pre[r]+cross(p[l],p[r])==0) continue;
            ans=min(ans,dp[l][r]+dp[r][l+n]);
        }//枚举凸包划分
    }
    cout<<ans<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}