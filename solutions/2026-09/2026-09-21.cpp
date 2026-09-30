#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
typedef long double ld;
struct node{
    ll p,v,w;
    node(ll p,ll v,ll w):p(p),v(v),w(w){};
    node(){};
};
void solve(){
    int n,m;
    cin>>n>>m;
    vector<node>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i].p>>a[i].v>>a[i].w;
    sort(a.begin()+1,a.end(),[&](node &A,node &B){
        return A.v<B.v;
    });//保证严格偏序下效益一定能生效
    vector<ld>dp(m+1);
    for(int i=1;i<=n;i++){
        for(int j=m;j>=a[i].w;j--){
            dp[j]=max(dp[j],(1.0L-a[i].p/100.00L)*dp[j-a[i].w]+a[i].p/100.00L*a[i].v);
        }
    }
    cout<<dp[m]<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    cout<<fixed<<setprecision(12);
    while(T--) solve();
    return 0;
}