#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll mod=1e9+7;
vector<ll>fac,invfac;
ll q_pow(ll x,ll y){
    ll s=1;
    while(y>0){
        if(y&1) s=s*x%mod;
        x=x*x%mod;
        y>>=1;
    }
    return s;
}
void init(int n){
    fac=invfac=vector<ll>(n+1,1);
    for(int i=1;i<=n;i++) fac[i]=fac[i-1]*i%mod;
    invfac[n]=q_pow(fac[n],mod-2);
    for(int i=n-1;i>=1;i--) invfac[i]=invfac[i+1]*(i+1)%mod;
}
ll C(ll x,ll y){
    if(x<y||x<0||y<0) return 0;
    return fac[x]*invfac[y]%mod*invfac[x-y]%mod;
}
ll dp[60][20][100];
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    init(200);
    ll n,m,k;
    cin>>n>>m>>k;
    memset(dp,-1,sizeof dp);
    auto dfs=[&](auto &&dfs,int pos,int lim,ll g) ->ll {
        if(pos<0) return g==0;
        if(dp[pos][lim][g]!=-1){
            return dp[pos][lim][g];
        }
        int up=((m>>pos&1)?lim:0);
        ll ans=0;
        for(int i=0;i<=k-lim;i++){
            for(int j=0;j<=up;j++){    
                int sum1=i+j;
                ll v=sum1*(k-sum1);
                ll ng=g*2+(n>>pos&1)-v;
                if(ng<0||ng>80) continue;
                int nlim=((m>>pos&1)?j:lim);
                ans+=C(k-lim,i)*C(lim,j)%mod*dfs(dfs,pos-1,nlim,ng)%mod;
                if(ans>=mod) ans-=mod;
            }
        }
        return dp[pos][lim][g]=ans;
    };
    cout<<dfs(dfs,59,k,0)<<endl;
    return 0;
} 