#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll mod=1e9+7;
ll q_pow(ll x,ll y){
    x=(x%mod+mod)%mod;
    ll s=1;
    while(y>0){
        if(y&1){
            s=s*x%mod;
        }
        x=x*x%mod;
        y>>=1;
    }
    return s;
}
void solve(){
    ll p,q,r;
    cin>>p>>q>>r;
    int n;cin>>n;
    vector<ll>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i];
    ll s=0;
    const ll Inv=q_pow(1000,mod-2)%mod;
    ll P=p*Inv%mod;
    ll nP=(1-P+mod)%mod;
    ll A=(P+nP*(q*Inv%mod)%mod)%mod;
    ll nA=(1-A+mod)%mod;
    ll R=r*Inv%mod;
    ll nR=(1-R+mod)%mod;
    vector<array<ll,2>>dp(n+1);//经过n轮,界外棋子数量恰好为0个，1个的概率
    dp[0][0]=1,dp[0][1]=0;
    for(int i=1;i<=n;i++){
        ll u=max(0LL,min(a[i],80-s));//剩余可放安全区棋子数量
        ll v=a[i]-u;//非安全区棋子数量
        dp[i][0]=dp[i-1][0]*q_pow(nP,u)%mod*q_pow(nA,v)%mod;
        dp[i][1]=(dp[i][1]+(nR)%mod*dp[i-1][1]%mod*q_pow(nP,u)%mod*q_pow(nA,v)%mod)%mod;
        dp[i][1]=(dp[i][1]+(u*P)%mod*dp[i-1][0]%mod*q_pow(nP,u-1)%mod*q_pow(nA,v)%mod)%mod;
        dp[i][1]=(dp[i][1]+(v*A)%mod*dp[i-1][0]%mod*q_pow(nP,u)%mod*q_pow(nA,v-1)%mod)%mod;
        s+=a[i];
        ll c1=dp[i-1][1]*R%mod;
        ll c2=dp[i-1][1]*nR%mod*(1-q_pow(nP,u)*q_pow(nA,v)%mod+mod)%mod;
        ll c3=dp[i-1][0]*(1-(q_pow(nP,u)*q_pow(nA,v)%mod)-((u*P)%mod*q_pow(nP,u-1)%mod*q_pow(nA,v)%mod+(v*A)%mod*q_pow(nP,u)%mod*q_pow(nA,v-1)%mod)%mod+2*mod)%mod;
        ll ans=(c1+c2+c3)%mod;
        cout<<ans<<endl;
    }
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    solve();
    return 0;
}