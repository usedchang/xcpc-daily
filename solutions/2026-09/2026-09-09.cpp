#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
ll exgcd(ll a,ll b,ll &x,ll&y){
    if(!b){
        x=1,y=0;
        return a;
    }
    ll d=exgcd(b,a%b,y,x);
    y-=a/b*x;
    return d;
}
ll inv(ll t,ll mod){
    ll x,y;
    exgcd(t,mod,x,y);
    return (x%mod+mod)%mod;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--){
        ll a,b;cin>>a>>b;
        ll q=(a&-a);
        ll A=a/q,B=b/q;
        ll k=__lg(A)+1;
        const ll mod=1LL<<k;
        cout<<a<<' '<<(mod-B*inv(A,mod)%mod)<<endl;
    }
    return 0;
}